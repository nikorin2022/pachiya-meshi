import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { SITE_AUDIT_REPORT_PATH } from "./config"
import type { SiteAuditReport } from "./types"

export type SiteReportFileOperations = Pick<typeof fs, "mkdir" | "writeFile" | "rename" | "rm">
export type WriteSiteAuditReportOptions = {
  readonly fileOperations?: SiteReportFileOperations
  readonly createToken?: () => string
}

export function resolveSiteAuditReportPath(repositoryRoot: string, output = SITE_AUDIT_REPORT_PATH): string {
  if (!output || output === "." || /[\u0000-\u001f\u007f]/u.test(output) || path.isAbsolute(output) || path.posix.isAbsolute(output) || path.win32.isAbsolute(output) || hasTraversalSegment(output)) {
    throw new Error("出力先はrepository root配下の相対パスで指定してください")
  }
  const root = path.resolve(repositoryRoot)
  const resolved = path.resolve(root, output)
  const relative = path.relative(root, resolved)
  if (!relative || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("出力先はrepository rootの外側に指定できません")
  }
  return resolved
}

function hasTraversalSegment(value: string): boolean {
  return value.split(/[\\/]+/u).some((segment) => segment === "..")
}

export async function writeSiteAuditReport(repositoryRoot: string, report: SiteAuditReport, output = SITE_AUDIT_REPORT_PATH, options: WriteSiteAuditReportOptions = {}): Promise<string> {
  const operations = options.fileOperations ?? fs
  const target = resolveSiteAuditReportPath(repositoryRoot, output)
  const directory = path.dirname(target)
  const token = validateToken((options.createToken ?? randomUUID)())
  const temporary = path.join(directory, `.${path.basename(target)}.${token}.tmp`)
  const backup = path.join(directory, `.${path.basename(target)}.${token}.bak`)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  JSON.parse(serialized)
  let primary: Error | null = null
  let preserveBackup = false
  try {
    await operations.mkdir(directory, { recursive: true })
    await operations.writeFile(temporary, serialized, "utf8")
    try {
      await operations.rename(temporary, target)
    } catch (error) {
      const code = errorCode(error)
      if (code !== "EEXIST" && code !== "EPERM") throw error
      await replaceForWindows(temporary, target, backup, operations)
    }
  } catch (error) {
    preserveBackup = error instanceof BackupRecoveryError
    primary = error instanceof SafeSiteWriteError ? error : new SafeSiteWriteError("サイト監査レポートを安全に書き出せません")
  }
  const temporaryCleaned = await removeSafely(operations, temporary)
  const backupCleaned = preserveBackup || await removeSafely(operations, backup)
  if (primary) throw primary
  if (!temporaryCleaned || !backupCleaned) throw new SafeSiteWriteError("サイト監査レポートの一時ファイルを安全に削除できません")
  return target
}

function validateToken(value: string): string {
  if (/^[A-Za-z0-9_-]{1,128}$/u.test(value)) return value
  throw new SafeSiteWriteError("サイト監査レポートの一時トークンが不正です")
}

async function replaceForWindows(temporary: string, target: string, backup: string, operations: SiteReportFileOperations): Promise<void> {
  let hasBackup = false
  try {
    await operations.rename(target, backup)
    hasBackup = true
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw new SafeSiteWriteError("既存サイト監査レポートを退避できません")
  }
  try {
    await operations.rename(temporary, target)
  } catch {
    if (hasBackup) {
      try {
        await operations.rename(backup, target)
        hasBackup = false
      } catch {
        throw new BackupRecoveryError("サイト監査レポートの復元に失敗しました")
      }
    }
    throw new SafeSiteWriteError("サイト監査レポートを置換できません")
  }
  if (hasBackup) {
    try { await operations.rm(backup) } catch { throw new SafeSiteWriteError("退避したサイト監査レポートを削除できません") }
  }
}

async function removeSafely(operations: SiteReportFileOperations, target: string): Promise<boolean> {
  try { await operations.rm(target, { force: true }); return true } catch { return false }
}

function errorCode(error: unknown): string {
  return error instanceof Error && "code" in error ? String((error as NodeJS.ErrnoException).code ?? "") : ""
}

class SafeSiteWriteError extends Error {}
class BackupRecoveryError extends SafeSiteWriteError {}
