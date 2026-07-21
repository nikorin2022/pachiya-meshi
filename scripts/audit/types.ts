import type {
  AiSummaryOverride,
  Area,
  Chain,
  ExclusionOverride,
  HallInput,
  RestaurantInput,
  WalkMinutesOverride,
} from "../lib/schema"

export type Severity = "critical" | "error" | "warning" | "info"

export type AuditStatus = "passed" | "passed_with_warnings" | "failed"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type AuditIssue = {
  /** code・対象・相対パス・正規化detailsから決まる安定ID */
  readonly id: string
  readonly code: string
  readonly severity: Severity
  readonly entityType: string
  readonly entityId: string | null
  /** リポジトリ相対POSIXパス。全体障害では null。 */
  readonly file: string | null
  readonly message: string
  readonly details: JsonValue
  readonly autoFixable: boolean
}

export type CheckedFile = {
  /** リポジトリ相対POSIXパス */
  readonly file: string
  readonly sha256: string
  readonly entities: number
}

export type AuditSummary = {
  readonly checkedEntities: number
  readonly checkedRules: number
  readonly critical: number
  readonly error: number
  readonly warning: number
  readonly info: number
}

export type AuditEnvironment = {
  readonly nodeVersion: string | null
  readonly npmVersion: string | null
  readonly branch: string | null
  readonly commitSha: string | null
}

export type AuditReport = {
  readonly schemaVersion: string
  readonly inputHash: string
  readonly status: AuditStatus
  readonly publishable: boolean
  readonly checkedAt: string
  readonly duration: number
  readonly summary: AuditSummary
  readonly criticalErrors: number
  readonly errors: number
  readonly warnings: number
  readonly info: number
  readonly issues: readonly AuditIssue[]
  readonly checkedFiles: readonly CheckedFile[]
  readonly environment: AuditEnvironment
}

export type AuditIndexes = {
  readonly areaById: ReadonlyMap<string, Area>
  readonly chainById: ReadonlyMap<string, Chain>
  readonly hallById: ReadonlyMap<string, HallInput>
  readonly restaurantById: ReadonlyMap<string, RestaurantInput>
  readonly hallsByPrefecture: ReadonlyMap<string, readonly HallInput[]>
  readonly restaurantsByPrefecture: ReadonlyMap<string, readonly RestaurantInput[]>
}

export type AuditData = {
  /** 内部処理専用。レポートやissueには出力しない。 */
  readonly repositoryRoot: string
  readonly prefectures: readonly string[]
  readonly areas: readonly Area[]
  readonly chains: readonly Chain[]
  readonly halls: readonly HallInput[]
  readonly restaurants: readonly RestaurantInput[]
  readonly hallsByPrefecture: ReadonlyMap<string, readonly HallInput[]>
  readonly restaurantsByPrefecture: ReadonlyMap<string, readonly RestaurantInput[]>
  readonly walkMinutesOverrides: readonly WalkMinutesOverride[]
  readonly aiSummaryOverrides: readonly AiSummaryOverride[]
  readonly exclusions: readonly ExclusionOverride[]
  readonly indexes: AuditIndexes
  readonly checkedFiles: readonly CheckedFile[]
  readonly inputHash: string
  readonly checkedEntities: number
}

export type AuditLoadErrorKind =
  | "repository_root"
  | "file_missing"
  | "file_read"
  | "json_parse"
  | "schema_validation"
  | "prefecture_data_missing"

/**
 * 元例外は cause として保持しつつ、レポート用には安全な種別と相対パスだけを公開する。
 */
export class AuditLoadError extends Error {
  readonly kind: AuditLoadErrorKind
  readonly file: string | null

  constructor(
    kind: AuditLoadErrorKind,
    message: string,
    options: { file?: string | null; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "AuditLoadError"
    this.kind = kind
    this.file = options.file ?? null
  }
}
