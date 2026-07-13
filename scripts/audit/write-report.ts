import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import type { AuditReport } from "./types"

export const DEFAULT_AUDIT_REPORT_PATH = "artifacts/automation/data-audit-report.json"

/** repository root配下に限定したレポート出力先を解決する。 */
export function resolveAuditReportPath(repositoryRoot: string, output = DEFAULT_AUDIT_REPORT_PATH): string {
  if (!output || path.isAbsolute(output)) {
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
): Promise<string> {
  const target = resolveAuditReportPath(repositoryRoot, output)
  const directory = path.dirname(target)
  const token = randomUUID()
  const basename = path.basename(target)
  const temporary = path.join(directory, `.${basename}.${token}.tmp`)
  const backup = path.join(directory, `.${basename}.${token}.bak`)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  JSON.parse(serialized)
  let preserveBackup = false

  try {
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(temporary, serialized, "utf8")
    try {
      await fs.rename(temporary, target)
    } catch (error) {
      const code = getErrorCode(error)
      if (code !== "EEXIST" && code !== "EPERM") throw error
      await replaceForWindows(temporary, target, backup)
    }
  } catch (error) {
    preserveBackup = error instanceof BackupRecoveryError
    if (error instanceof SafeWriteError) throw error
    throw new SafeWriteError("監査レポートを安全に書き込めません")
  } finally {
    await fs.rm(temporary, { force: true })
    if (!preserveBackup) await fs.rm(backup, { force: true })
  }
  return target
}

async function replaceForWindows(temporary: string, target: string, backup: string): Promise<void> {
  let hasBackup = false
  try {
    await fs.rename(target, backup)
    hasBackup = true
  } catch (error) {
    if (getErrorCode(error) !== "ENOENT") {
      throw new SafeWriteError("既存の監査レポートを退避できません")
    }
  }

  try {
    await fs.rename(temporary, target)
  } catch {
    if (hasBackup) {
      try {
        await fs.rename(backup, target)
        hasBackup = false
      } catch {
        throw new BackupRecoveryError("監査レポートの置換に失敗し、既存レポートを復元できません")
      }
    }
    throw new SafeWriteError("監査レポートを置換できません")
  }

  if (hasBackup) {
    try {
      await fs.rm(backup)
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
