import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import type { AuditReport } from "./types"

export const DEFAULT_AUDIT_REPORT_PATH = "artifacts/automation/data-audit-report.json"

export type AuditReportFileOperations = Pick<typeof fs, "mkdir" | "writeFile" | "rename" | "rm">

export type WriteAuditReportOptions = {
  /** Node標準fsを既定にし、組み込み利用で安全なファイル操作を差し替えられるようにする。 */
  readonly fileOperations?: AuditReportFileOperations
  /** 一時ファイル名だけを決める。レポート内容には影響しない。 */
  readonly createToken?: () => string
}

/** repository root配下に限定したレポート出力先を解決する。 */
export function resolveAuditReportPath(repositoryRoot: string, output = DEFAULT_AUDIT_REPORT_PATH): string {
  if (!output || path.isAbsolute(output) || path.posix.isAbsolute(output) || path.win32.isAbsolute(output)) {
    throw new Error("出力先はrepository root基準の相対パスで指定してください")
  }
  const root = path.resolve(repositoryRoot)
  const resolved = path.resolve(root, output)
  const relative = path.relative(root, resolved)
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("出力先はrepository rootの外に指定できません")
  }
  return resolved
}

/** UTF-8・2空白インデントのJSONを同一ディレクトリの一時ファイル経由で確定する。 */
export async function writeAuditReport(
  repositoryRoot: string,
  report: AuditReport,
  output = DEFAULT_AUDIT_REPORT_PATH,
  options: WriteAuditReportOptions = {},
): Promise<string> {
  const fileOperations = options.fileOperations ?? fs
  const target = resolveAuditReportPath(repositoryRoot, output)
  const directory = path.dirname(target)
  const token = validateTemporaryToken((options.createToken ?? randomUUID)())
  const basename = path.basename(target)
  const temporary = path.join(directory, `.${basename}.${token}.tmp`)
  const backup = path.join(directory, `.${basename}.${token}.bak`)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  JSON.parse(serialized)
  let preserveBackup = false
  let primaryError: SafeWriteError | null = null

  try {
    await fileOperations.mkdir(directory, { recursive: true })
    await fileOperations.writeFile(temporary, serialized, "utf8")
    try {
      await fileOperations.rename(temporary, target)
    } catch (error) {
      const code = getErrorCode(error)
      if (code !== "EEXIST" && code !== "EPERM") throw error
      await replaceForWindows(temporary, target, backup, fileOperations)
    }
  } catch (error) {
    preserveBackup = error instanceof BackupRecoveryError
    primaryError = error instanceof SafeWriteError
      ? error
      : new SafeWriteError("監査レポートを安全に書き込めません")
  }

  const temporaryCleaned = await removeSafely(fileOperations, temporary)
  const backupCleaned = preserveBackup || await removeSafely(fileOperations, backup)
  if (primaryError) throw primaryError
  if (!temporaryCleaned || !backupCleaned) {
    throw new SafeWriteError("監査レポートの一時ファイルを安全に削除できません")
  }
  return target
}

function validateTemporaryToken(value: string): string {
  if (/^[A-Za-z0-9_-]{1,128}$/u.test(value)) return value
  throw new SafeWriteError("監査レポートの一時ファイル識別子が不正です")
}

/** cleanupの元例外はレポート出力のAPI境界から漏らさない。 */
async function removeSafely(fileOperations: AuditReportFileOperations, target: string): Promise<boolean> {
  try {
    await fileOperations.rm(target, { force: true })
    return true
  } catch {
    return false
  }
}

async function replaceForWindows(
  temporary: string,
  target: string,
  backup: string,
  fileOperations: AuditReportFileOperations,
): Promise<void> {
  let hasBackup = false
  try {
    await fileOperations.rename(target, backup)
    hasBackup = true
  } catch (error) {
    if (getErrorCode(error) !== "ENOENT") {
      throw new SafeWriteError("既存の監査レポートを退避できません")
    }
  }

  try {
    await fileOperations.rename(temporary, target)
  } catch {
    if (hasBackup) {
      try {
        await fileOperations.rename(backup, target)
        hasBackup = false
      } catch {
        throw new BackupRecoveryError("監査レポートの置換に失敗し、既存レポートを復元できません")
      }
    }
    throw new SafeWriteError("監査レポートを置換できません")
  }

  if (hasBackup) {
    try {
      await fileOperations.rm(backup)
    } catch {
      throw new SafeWriteError("置換後の監査レポートbackupを削除できません")
    }
  }
}

function getErrorCode(error: unknown): string {
  return error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code ?? "")
    : ""
}

class SafeWriteError extends Error {}

class BackupRecoveryError extends SafeWriteError {}
