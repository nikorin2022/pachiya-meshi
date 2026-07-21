export type PrefectureBoundingBox = {
  readonly minLat: number
  readonly maxLat: number
  readonly minLng: number
  readonly maxLng: number
}

/**
 * S1-03 では都道府県ごとの粗い矩形だけを使う。境界付近の誤検知を避けるため
 * 実際の行政界より広く取り、正式な polygon 判定は後続フェーズで扱う。
 */
export const PREFECTURE_BOUNDING_BOXES: ReadonlyMap<string, PrefectureBoundingBox> = new Map([
  ["愛知県", { minLat: 34.5, maxLat: 35.7, minLng: 136.4, maxLng: 137.6 }],
  ["福岡県", { minLat: 32.9, maxLat: 34.2, minLng: 129.0, maxLng: 131.3 }],
  ["北海道", { minLat: 41.0, maxLat: 45.8, minLng: 139.0, maxLng: 146.8 }],
  ["宮城県", { minLat: 37.4, maxLat: 39.4, minLng: 140.2, maxLng: 142.0 }],
  ["大阪府", { minLat: 34.1, maxLat: 35.3, minLng: 134.2, maxLng: 136.0 }],
  ["東京都", { minLat: 35.3, maxLat: 36.1, minLng: 138.8, maxLng: 140.4 }],
])
