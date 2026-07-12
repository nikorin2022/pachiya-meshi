/**
 * 監査基盤の契約バージョン。
 *
 * 未確定の閾値・都道府県境界・除外チェーンなどは S1-01 では持ち込まない。
 */
/**
 * 監査コードまたは severity 規則の追加・変更では AUDIT_RULE_VERSION を更新する。
 * 閾値、bounding box、除外条件などの変更では AUDIT_CONFIG_VERSION を更新する。
 * AuditReport JSON 契約を破壊的に変更する場合だけ AUDIT_SCHEMA_VERSION を更新する。
 */
export const AUDIT_SCHEMA_VERSION = "1.0.0"
export const AUDIT_RULE_VERSION = "1.2.0"
export const AUDIT_CONFIG_VERSION = "1.1.0"

export const AUDIT_SEVERITY_ORDER = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
} as const
