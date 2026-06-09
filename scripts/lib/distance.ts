// 距離計算ユーティリティ
//
// 設計方針:
//   - 直線距離 (Haversine) に都市迂回係数を掛けて、推定徒歩距離を出す
//   - 不動産公正取引協議会の規約に倣い徒歩速度は 80 m/分 で固定
//   - 結果は安全側（切り上げ）に丸める
//
// 将来 Distance Matrix API 等で実測値が取れるようになった場合は、
// `estimateWalkMinutes` を差し替えることで上位ロジックは無改修で済む。

const EARTH_RADIUS_M = 6371008.8
const WALK_SPEED_M_PER_MIN = 80
const URBAN_DETOUR_FACTOR = 1.3

export type LatLng = {
  readonly lat: number
  readonly lng: number
}

/** 2地点間の球面距離 (m)。日本国内の距離では誤差0.5%以下。 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * 2地点間の推定徒歩分数 (整数, 切り上げ)。
 *
 * 検算例:
 *   - 同一座標   →  1 分 (最低値)
 *   - 直線 615m  → 10 分 (境界)  ※ 800 / 80 = 10
 *   - 直線 1000m → 17 分
 */
export function estimateWalkMinutes(a: LatLng, b: LatLng): number {
  const directM = haversineMeters(a, b)
  const walkingM = directM * URBAN_DETOUR_FACTOR
  return Math.max(1, Math.ceil(walkingM / WALK_SPEED_M_PER_MIN))
}
