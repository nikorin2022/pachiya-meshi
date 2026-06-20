// ホール↔飲食店の自動紐付け
//
// 設計方針:
//   - 全飲食店 × 全ホールを毎回走査するのは O(N*M) で重いので、
//     bounding box の粗フィルタで先に候補を絞る
//   - 推定 walkMinutes が 10 を超える店は除外
//   - walk-minutes override があれば、推定値より override を優先 (推定値が
//     実態と乖離するケースの救済)
//   - 安定した出力順序を保証するため walkMinutes 昇順 + id 辞書順でソート

import { estimateWalkMinutes, haversineMeters } from "./distance"
import type {
  ExclusionOverride,
  HallInput,
  RestaurantInput,
  WalkMinutesOverride,
} from "./schema"

const MAX_STRAIGHT_M = 800
const MAX_WALK_MINUTES = 10

/** bounding box 粗フィルタの上限 (km)。10分=直線約615mより十分広く取る。 */
const BBOX_PREFILTER_KM = 1.5

export type MatchedRestaurant = {
  restaurant: RestaurantInput
  walkMinutes: number
  /** 推定値ではなく override が適用されたか */
  isOverride: boolean
}

export class RestaurantMatcher {
  /** key = `${hall_id}|${restaurant_id}` */
  private readonly overrideIndex: Map<string, WalkMinutesOverride>
  /** key = `${hall_id}|${restaurant_id}` */
  private readonly exclusionIndex: Set<string>

  constructor(
    private readonly restaurants: RestaurantInput[],
    walkOverrides: WalkMinutesOverride[],
    exclusions: ExclusionOverride[],
  ) {
    this.overrideIndex = new Map(
      walkOverrides.map((o) => [`${o.hall_id}|${o.restaurant_id}`, o]),
    )
    this.exclusionIndex = new Set(
      exclusions.map((e) => `${e.hall_id}|${e.restaurant_id}`),
    )
  }

  /**
   * 指定ホールに対して 10分以内の飲食店を抽出。
   * walkMinutes 昇順、同分なら id 辞書順でソート済。
   */
  matchForHall(hall: HallInput): MatchedRestaurant[] {
    const matches: MatchedRestaurant[] = []

    for (const r of this.restaurants) {
      // STEP 0: 明示除外があれば最優先でスキップ (距離計算より前)
      if (this.exclusionIndex.has(`${hall.id}|${r.id}`)) continue

      // STEP 1: bounding box 粗フィルタ (Haversine 計算を回避)
      if (!withinBoundingBox(hall, r, BBOX_PREFILTER_KM)) continue

      // STEP 1b: 直線距離 800m 超は掲載対象外（徒歩10分圏の厳守）
      if (haversineMeters(hall, r) > MAX_STRAIGHT_M) continue

      // STEP 2: walk-minutes override 適用判定
      const override = this.overrideIndex.get(`${hall.id}|${r.id}`)
      let walkMinutes: number
      let isOverride: boolean
      if (override) {
        walkMinutes = override.walkMinutes
        isOverride = true
      } else {
        walkMinutes = estimateWalkMinutes(hall, r)
        isOverride = false
      }

      // STEP 3: 10分以内のみ採用
      if (walkMinutes > MAX_WALK_MINUTES) continue

      matches.push({ restaurant: r, walkMinutes, isOverride })
    }

    matches.sort((a, b) => {
      if (a.walkMinutes !== b.walkMinutes) {
        return a.walkMinutes - b.walkMinutes
      }
      return a.restaurant.id.localeCompare(b.restaurant.id)
    })

    return matches
  }
}

/**
 * 緯度経度から見た「ざっくり同じ範囲か」の粗判定。
 * 正確な距離は Haversine に任せ、ここは N×M 計算を間引く目的のみ。
 */
function withinBoundingBox(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  limitKm: number,
): boolean {
  // 日本の緯度 1度 ≒ 111km, 経度 1度 ≒ 91km (35度線で)
  const latDiffKm = Math.abs(a.lat - b.lat) * 111
  if (latDiffKm > limitKm) return false
  const lngDiffKm = Math.abs(a.lng - b.lng) * 91
  if (lngDiffKm > limitKm) return false
  return true
}
