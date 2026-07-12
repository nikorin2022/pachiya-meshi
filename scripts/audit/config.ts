/**
 * 監査基盤の契約バージョン。
 *
 * 未確定の閾値・都道府県境界・除外チェーンなどは S1-01 では持ち込まない。
 */
export const AUDIT_SCHEMA_VERSION = "1.0.0"
export const AUDIT_RULE_VERSION = "1.0.0"
export const AUDIT_CONFIG_VERSION = "1.0.0"

export const AUDIT_SEVERITY_ORDER = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
} as const
