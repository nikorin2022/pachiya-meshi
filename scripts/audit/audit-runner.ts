import { createHash } from "node:crypto"
import { checkGeo, GEO_RULE_CODES, GEO_RULE_COUNT } from "./check-geo"
import { checkHalls, HALL_RULE_CODES, HALL_RULE_COUNT } from "./check-halls"
import { checkIdentity, IDENTITY_RULE_CODES, IDENTITY_RULE_COUNT } from "./check-identity"
import { checkMaps } from "./check-maps"
import { checkReferences, REFERENCE_RULE_CODES, REFERENCE_RULE_COUNT } from "./check-references"
import { checkRestaurants, RESTAURANT_RULE_CODES, RESTAURANT_RULE_COUNT } from "./check-restaurants"
import { AUDIT_CONFIG_VERSION, AUDIT_RULE_VERSION, AUDIT_SCHEMA_VERSION } from "./config"
import { loadAuditData } from "./load-data"
import {
  collectAuditEnvironment,
  createAuditIssue,
  createAuditReport,
  createSystemCriticalIssue,
  getAuditExitCode,
} from "./report"
import type { AuditData, AuditEnvironment, AuditIssue, AuditReport } from "./types"

export type RunAuditOptions = {
  readonly repositoryRoot?: string
  readonly checkedAt?: string
  readonly now?: () => number
}

export type RunAuditResult = {
  readonly report: AuditReport
  readonly exitCode: 0 | 1 | 2
}

type AuditStage =
  | "checkIdentity"
  | "checkReferences"
  | "checkHalls"
  | "checkRestaurants"
  | "checkGeo"
  | "checkMaps"

const RULE_CODES = [
  ...IDENTITY_RULE_CODES,
  ...REFERENCE_RULE_CODES,
  ...HALL_RULE_CODES,
  ...RESTAURANT_RULE_CODES,
  ...GEO_RULE_CODES,
] as const

export const AUDIT_RULE_COUNT =
  IDENTITY_RULE_COUNT +
  REFERENCE_RULE_COUNT +
  HALL_RULE_COUNT +
  RESTAURANT_RULE_COUNT +
  GEO_RULE_COUNT

/** 50個の既存監査ルールを一度だけロードした正本データへ統合実行する。 */
export async function runAudit(options: RunAuditOptions = {}): Promise<RunAuditResult> {
  const now = options.now ?? Date.now
  const startedAt = now()
  const checkedAt = options.checkedAt ?? new Date(startedAt).toISOString()
  let data: AuditData

  try {
    data = await loadAuditData({ repositoryRoot: options.repositoryRoot })
  } catch (error) {
    const issue = createSystemCriticalIssue(error)
    return finishFallbackReport({
      issue,
      checkedAt,
      duration: now() - startedAt,
      repositoryRoot: options.repositoryRoot,
    })
  }

  const environment = await collectAuditEnvironment(data.repositoryRoot)
  const registryIssue = validateRuleRegistry()
  if (registryIssue) {
    return finishReport({
      data,
      environment,
      checkedAt,
      duration: now() - startedAt,
      issues: [registryIssue],
    })
  }

  try {
    const issues = [
      ...executeAuditStage("checkIdentity", () => checkIdentity(data)),
      ...executeAuditStage("checkReferences", () => checkReferences(data)),
      ...executeAuditStage("checkHalls", () => checkHalls(data)),
      ...executeAuditStage("checkRestaurants", () => checkRestaurants(data)),
      ...executeAuditStage("checkGeo", () => checkGeo(data)),
      ...executeAuditStage("checkMaps", () => checkMaps(data)),
    ]
    return finishReport({
      data,
      environment,
      checkedAt,
      duration: now() - startedAt,
      issues,
    })
  } catch (error) {
    return finishReport({
      data,
      environment,
      checkedAt,
      duration: now() - startedAt,
      issues: [createExecutionFailureIssue(error instanceof AuditStageFailure ? error.stage : "unknown")],
    })
  }
}

function finishReport(input: {
  readonly data: AuditData
  readonly environment: AuditEnvironment
  readonly checkedAt: string
  readonly duration: number
  readonly issues: readonly AuditIssue[]
}): RunAuditResult {
  const report = createAuditReport({
    inputHash: input.data.inputHash,
    checkedAt: input.checkedAt,
    duration: input.duration,
    checkedEntities: input.data.checkedEntities,
    checkedRules: AUDIT_RULE_COUNT,
    issues: input.issues,
    checkedFiles: input.data.checkedFiles,
    environment: input.environment,
  })
  return { report, exitCode: getAuditExitCode(report.issues) }
}

function finishFallbackReport(input: {
  readonly issue: AuditIssue
  readonly checkedAt: string
  readonly duration: number
  readonly repositoryRoot?: string
}): RunAuditResult {
  const report = createAuditReport({
    inputHash: createFailureInputHash(input.issue),
    checkedAt: input.checkedAt,
    duration: input.duration,
    checkedEntities: 0,
    checkedRules: AUDIT_RULE_COUNT,
    issues: [input.issue],
    checkedFiles: [],
    environment: fallbackEnvironment(input.repositoryRoot),
  })
  return { report, exitCode: 2 }
}

function validateRuleRegistry(): AuditIssue | null {
  const uniqueRuleCodes = new Set(RULE_CODES)
  if (AUDIT_RULE_COUNT === 50 && RULE_CODES.length === 50 && uniqueRuleCodes.size === 50) return null
  return createAuditIssue({
    code: "AUDIT_SYSTEM_RULE_REGISTRY_INVALID",
    severity: "critical",
    entityType: "system",
    entityId: null,
    file: null,
    message: "監査ルール定義の件数またはコードが不正です",
    details: {
      declaredRuleCount: AUDIT_RULE_COUNT,
      registryCodeCount: RULE_CODES.length,
      uniqueCodeCount: uniqueRuleCodes.size,
    },
    autoFixable: false,
  })
}

function executeAuditStage(
  stage: AuditStage,
  execute: () => readonly AuditIssue[],
): readonly AuditIssue[] {
  try {
    return execute()
  } catch {
    throw new AuditStageFailure(stage)
  }
}

function createExecutionFailureIssue(stage: AuditStage | "unknown"): AuditIssue {
  return createAuditIssue({
    code: "AUDIT_SYSTEM_EXECUTION_FAILURE",
    severity: "critical",
    entityType: "system",
    entityId: null,
    file: null,
    message: "監査処理中に予期しないエラーが発生しました",
    details: { kind: "execution_failure", stage },
    autoFixable: false,
  })
}

class AuditStageFailure extends Error {
  constructor(readonly stage: AuditStage) {
    super(stage)
  }
}

function createFailureInputHash(issue: AuditIssue): string {
  // 正常入力のinputHashではなく、読込失敗状態を安全に安定識別するfallback hash。
  return createHash("sha256").update(JSON.stringify({
    schemaVersion: AUDIT_SCHEMA_VERSION,
    ruleVersion: AUDIT_RULE_VERSION,
    configVersion: AUDIT_CONFIG_VERSION,
    code: issue.code,
    kind: (issue.details as { readonly kind?: string }).kind ?? "unknown",
    file: issue.file,
  })).digest("hex")
}

function fallbackEnvironment(repositoryRoot?: string): AuditEnvironment {
  return Object.freeze({
    nodeVersion: process.version || null,
    npmVersion: null,
    branch: null,
    commitSha: null,
  })
}
