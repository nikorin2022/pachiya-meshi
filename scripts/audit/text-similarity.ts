/**
 * S1-03 の説明文比較は、Unicode と空白を正規化したうえで文字 2-gram の
 * Jaccard 類似度を用いる。外部 API や追加パッケージには依存しない。
 */
export const HALL_DESCRIPTION_SIMILARITY_MIN_LENGTH = 80

/**
 * 現行134ホールでは、各フィールドの比較数は8,911ペア（2フィールド合計17,822ペア）。
 * pachiya_comment は p99 約0.491・最大約0.731、meal_guide は p99 約0.664・最大約0.960
 * だった。通常の定型表現を警告しないため0.9を採用し、将来の分布に応じて
 * AUDIT_CONFIG_VERSION とともに見直す。
 */
export const HALL_DESCRIPTION_SIMILARITY_THRESHOLD = 0.9

export function normalizeHallName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\s　]+/gu, " ")
    .toLocaleLowerCase("en-US")
}

export function normalizeHallText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
}

export function bigramJaccardSimilarity(left: string, right: string): number {
  const leftBigrams = toBigrams(left)
  const rightBigrams = toBigrams(right)
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0

  let intersection = 0
  for (const bigram of leftBigrams) {
    if (rightBigrams.has(bigram)) intersection += 1
  }
  return intersection / (leftBigrams.size + rightBigrams.size - intersection)
}

function toBigrams(value: string): ReadonlySet<string> {
  const normalized = normalizeHallText(value)
  const bigrams = new Set<string>()
  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.add(normalized.slice(index, index + 2))
  }
  return bigrams
}
