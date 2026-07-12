import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { AUDIT_SCHEMA_VERSION, AUDIT_SEVERITY_ORDER } from "./config"
import type {
  AuditEnvironment,
  AuditIssue,
  AuditReport,
  AuditStatus,
  AuditSummary,
  CheckedFile,
  JsonValue,
  Severity,
} from "./types"
import { AuditLoadError } from "./types"

const execFileAsync = promisify(execFile)

export type CreateAuditIssueInput = Omit<AuditIssue, "id" | "details"> & {
  details: JsonValue
}

export type CreateAuditReportInput = {
  inputHash: string
  checkedAt: string
  duration: number
  checkedEntities: number
  checkedRules?: number
  issues?: readonly AuditIssue[]
  checkedFiles: readonly CheckedFile[]
  environment: AuditEnvironment
}

export function createAuditIssue(input: CreateAuditIssueInput): AuditIssue {
  const details = normalizeJsonValue(input.details)
  const id = sha256(
    stableStringify({
      code: input.code,
      entityType: input.entityType,
      entityId: input.entityId,
      file: input.file,
      details,
    }),
  )

  return Object.freeze({ ...input, id, details })
}

/** 読み込み失敗を安全なsystem critical issueへ変換する。元例外はcauseで追跡できる。 */
export function createSystemCriticalIssue(error: unknown): AuditIssue {
  const loadError = error instanceof AuditLoadError ? error : null
  return createAuditIssue({
    code: "AUDIT_SYSTEM_LOAD_FAILURE",
    severity: "critical",
    entityType: "system",
    entityId: null,
    file: loadError?.file ?? null,
    message: "監査入力の読み込みに失敗しました",
    details: {
      kind: loadError?.kind ?? "unknown",
    },
    autoFixable: false,
  })
}

export function createAuditReport(input: CreateAuditReportInput): AuditReport {
  const issues = sortAuditIssues(input.issues ?? [])
  const summary = summarizeIssues(issues, input.checkedEntities, input.checkedRules ?? 0)
  const status = getAuditStatus(summary)
  const publishable = summary.critical === 0 && summary.error === 0

  return Object.freeze({
    schemaVersion: AUDIT_SCHEMA_VERSION,
    inputHash: input.inputHash,
    status,
    publishable,
    checkedAt: input.checkedAt,
    duration: input.duration,
    summary,
    criticalErrors: summary.critical,
    errors: summary.error,
    warnings: summary.warning,
    info: summary.info,
    issues,
    checkedFiles: sortCheckedFiles(input.checkedFiles),
    environment: Object.freeze({ ...input.environment }),
  })
}

export function getAuditExitCode(issues: readonly AuditIssue[]): 0 | 1 | 2 {
  if (issues.some((issue) => issue.severity === "critical")) return 2
  if (issues.some((issue) => issue.severity === "error")) return 1
  return 0
}

export async function collectAuditEnvironment(
  repositoryRoot: string,
): Promise<AuditEnvironment> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
  const [npmVersion, branch, commitSha] = await Promise.all([
    runCommand(npmCommand, ["--version"], repositoryRoot),
    runCommand("git", ["branch", "--show-current"], repositoryRoot),
    runCommand("git", ["rev-parse", "HEAD"], repositoryRoot),
  ])

  return Object.freeze({
    nodeVersion: process.version || null,
    npmVersion,
    branch,
    commitSha,
  })
}

export function sortAuditIssues(issues: readonly AuditIssue[]): readonly AuditIssue[] {
  return Object.freeze(
    [...issues].sort((a, b) => {
      const severity = AUDIT_SEVERITY_ORDER[a.severity] - AUDIT_SEVERITY_ORDER[b.severity]
      if (severity !== 0) return severity
      return compareStrings(a.code, b.code) ||
        compareStrings(a.file ?? "", b.file ?? "") ||
        compareStrings(a.entityType, b.entityType) ||
        compareStrings(a.entityId ?? "", b.entityId ?? "") ||
        compareStrings(a.id, b.id)
    }),
  )
}

export function summarizeIssues(
  issues: readonly AuditIssue[],
  checkedEntities: number,
  checkedRules: number,
): AuditSummary {
  const counts: Record<Severity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  }
  for (const issue of issues) counts[issue.severity] += 1
  return Object.freeze({
    checkedEntities,
    checkedRules,
    critical: counts.critical,
    error: counts.error,
    warning: counts.warning,
    info: counts.info,
  })
}

export function getAuditStatus(summary: AuditSummary): AuditStatus {
  if (summary.critical > 0 || summary.error > 0) return "failed"
  if (summary.warning > 0) return "passed_with_warnings"
  return "passed"
}

function sortCheckedFiles(checkedFiles: readonly CheckedFile[]): readonly CheckedFile[] {
  return Object.freeze(
    [...checkedFiles]
      .sort((a, b) => compareStrings(a.file, b.file))
      .map((file) => Object.freeze({ ...file })),
  )
}

async function runCommand(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(command, [...args], {
      cwd,
      windowsHide: true,
    })
    const value = stdout.trim()
    return value || null
  } catch {
    return null
  }
}

function normalizeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    // 配列順には意味があり得るため保持する。順不同の値は個別監査ルール側で
    // createAuditIssue() を呼ぶ前に明示的にソートする。
    return Object.freeze(value.map((item) => normalizeJsonValue(item)))
  }
  if (value !== null && typeof value === "object") {
    const objectValue = value as { readonly [key: string]: JsonValue }
    const normalized: Record<string, JsonValue> = {}
    for (const key of Object.keys(objectValue).sort(compareStrings)) {
      normalized[key] = normalizeJsonValue(objectValue[key])
    }
    return Object.freeze(normalized)
  }
  return value
}

function stableStringify(value: JsonValue | Record<string, unknown>): string {
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
