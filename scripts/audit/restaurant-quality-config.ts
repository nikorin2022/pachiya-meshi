/** S1-04 の飲食店固有監査に使う設定。変更時は AUDIT_CONFIG_VERSION を更新する。 */
export const RESTAURANT_SUMMARY_EXACT_MIN_LENGTH = 20
export const RESTAURANT_SUMMARY_SIMILARITY_MIN_LENGTH = 30

/**
 * 現行正本の分布では default summary は93,528ペアでp99=0.375・最大=0.919、
 * override summary は55ペアで最大=0.220だった。短文を除外し、通常文の誤検知を
 * 抑えるため0.9をwarning閾値とする。
 */
export const RESTAURANT_SUMMARY_SIMILARITY_THRESHOLD = 0.9

export const RESTAURANT_ADDRESS_WARNING_MIN_LENGTH = 8

export const RESTAURANT_ADDRESS_PLACEHOLDERS = [
  "住所不明",
  "不明",
  "未定",
  "仮住所",
  "仮データ",
  "テスト",
  "サンプル",
  "dummy",
  "unknown",
  "tbd",
] as const

export const RESTAURANT_FABRICATION_SIGNALS = [
  "seed",
  "推測",
  "未確認",
  "仮データ",
  "要確認",
  "架空",
  "placeholder",
  "dummy",
] as const

export const RESTAURANT_SUMMARY_FABRICATION_SIGNALS = [
  "サンプル文章",
  "仮の紹介文",
  "todo",
  "tbd",
  "placeholder",
  "aiが生成しました",
] as const
