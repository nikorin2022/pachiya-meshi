import { createHash } from "node:crypto"
import type { PachinkoHall } from "../../lib/halls/types"
import { checkGeo, GEO_RULE_CODES, GEO_RULE_COUNT } from "./check-geo"
import { checkHalls, HALL_RULE_CODES, HALL_RULE_COUNT } from "./check-halls"
import { checkIdentity, IDENTITY_RULE_CODES, IDENTITY_RULE_COUNT } from "./check-identity"
import { checkMaps } from "./check-maps"
import { checkReferences, REFERENCE_RULE_CODES, REFERENCE_RULE_COUNT } from "./check-references"
import { checkRestaurants, RESTAURANT_RULE_CODES, RESTAURANT_RULE_COUNT } from "./check-restaurants"
import { AUDIT_CONFIG_VERSION, AUDIT_RULE_VERSION, AUDIT_SCHEMA_VERSION } from "./config"
import { getGeneratedHallsSnapshot } from "./generated-snapshot"
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
  /**
   * テストや埋め込み利用で、コミット済み生成スナップショットの代わりに
   * 明示的な生成ホールを監査するための任意入力。CLIの既定値は変えない。
   */
  readonly generatedHalls?: readonly PachinkoHall[]
  /** 通常の監査段階を置き換えるための小さな依存注入口。 */
  readonly stages?: Partial<AuditStageExecutors>
}

export type RunAuditResult = {
  readonly report: AuditReport
  readonly exitCode: 0 | 1 | 2
}

export type AuditStage =
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

export const AUDIT_RULE_CODES: readonly string[] = RULE_CODES

export const AUDIT_RULE_COUNT =
  IDENTITY_RULE_COUNT +
  REFERENCE_RULE_COUNT +
  HALL_RULE_COUNT +
  RESTAURANT_RULE_COUNT +
  GEO_RULE_COUNT

export type AuditStageExecutors = {
  readonly [stage in AuditStage]: (
    data: AuditData,
    generatedHalls: readonly PachinkoHall[] | undefined,
  ) => readonly AuditIssue[]
}

const defaultAuditStages: AuditStageExecutors = {
  checkIdentity: (data) => checkIdentity(data),
  checkReferences: (data) => checkReferences(data),
  checkHalls: (data) => checkHalls(data),
  checkRestaurants: (data) => checkRestaurants(data),
  checkGeo: (data, generatedHalls) => checkGeo(data, generatedHalls),
  checkMaps: (data, generatedHalls) => checkMaps(data, generatedHalls),
}

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
  let generatedHalls: readonly PachinkoHall[]
  let inputHash: string
  try {
    generatedHalls = Object.freeze([...(options.generatedHalls ?? getGeneratedHallsSnapshot())])
    inputHash = createAuditInputHash(data.inputHash, createGeneratedSnapshotHash(generatedHalls))
  } catch {
    return finishReport({
      data,
      environment,
      inputHash: data.inputHash,
      checkedAt,
      duration: now() - startedAt,
      issues: [createExecutionFailureIssue("generatedSnapshot")],
    })
  }

  const registryIssue = validateRuleRegistry()
  if (registryIssue) {
    return finishReport({
      data,
      environment,
      inputHash,
      checkedAt,
      duration: now() - startedAt,
      issues: [registryIssue],
    })
  }

  try {
    const stages: AuditStageExecutors = { ...defaultAuditStages, ...options.stages }
    const issues = [
      ...executeAuditStage("checkIdentity", () => stages.checkIdentity(data, generatedHalls)),
      ...executeAuditStage("checkReferences", () => stages.checkReferences(data, generatedHalls)),
      ...executeAuditStage("checkHalls", () => stages.checkHalls(data, generatedHalls)),
      ...executeAuditStage("checkRestaurants", () => stages.checkRestaurants(data, generatedHalls)),
      ...executeAuditStage("checkGeo", () => stages.checkGeo(data, generatedHalls)),
      ...executeAuditStage("checkMaps", () => stages.checkMaps(data, generatedHalls)),
    ]
    return finishReport({
      data,
      environment,
      inputHash,
      checkedAt,
      duration: now() - startedAt,
      issues,
    })
  } catch (error) {
    return finishReport({
      data,
      environment,
      inputHash,
      checkedAt,
      duration: now() - startedAt,
      issues: [createExecutionFailureIssue(error instanceof AuditStageFailure ? error.stage : "unknown")],
    })
  }
}

function finishReport(input: {
  readonly data: AuditData
  readonly environment: AuditEnvironment
  readonly inputHash: string
  readonly checkedAt: string
  readonly duration: number
  readonly issues: readonly AuditIssue[]
}): RunAuditResult {
  const report = createAuditReport({
    inputHash: input.inputHash,
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

function createExecutionFailureIssue(stage: AuditStage | "generatedSnapshot" | "unknown"): AuditIssue {
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

/** 生成物はファイルではないため、キー順を固定したJSON表現を専用にhash化する。 */
export function createGeneratedSnapshotHash(generatedHalls: readonly PachinkoHall[]): string {
  return createHash("sha256").update(stableStringify(generatedHalls)).digest("hex")
}

export function createAuditInputHash(sourceInputHash: string, generatedSnapshotHash: string): string {
  return createHash("sha256").update(stableStringify({
    sourceInputHash,
    generatedSnapshotHash,
    schemaVersion: AUDIT_SCHEMA_VERSION,
    ruleVersion: AUDIT_RULE_VERSION,
    configVersion: AUDIT_CONFIG_VERSION,
  })).digest("hex")
}

function stableStringify(value: unknown): string {
  const ancestors = new Set<object>()
  return stringify(value, ancestors)
}

function stringify(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("generated snapshot contains a non-finite number")
    return Object.is(value, -0) ? "-0" : String(value)
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("generated snapshot contains a cycle")
    ancestors.add(value)
    const result = `[${value.map((item) => stringify(item, ancestors)).join(",")}]`
    ancestors.delete(value)
    return result
  }
  if (typeof value !== "object") throw new TypeError("generated snapshot contains a non-JSON value")
  if (ancestors.has(value)) throw new TypeError("generated snapshot contains a cycle")
  ancestors.add(value)
  const result = `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stringify((value as Record<string, unknown>)[key], ancestors)}`).join(",")}}`
  ancestors.delete(value)
  return result
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
