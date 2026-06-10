import type { Restaurant } from "@/lib/halls/types"

/** おすすめ店舗 TOP3 の1件分 */
export type RecommendedRestaurantEntry = {
  rank: number
  restaurant: Restaurant
  estimatedWalkMinutes: number
}

/**
 * 飲食店の徒歩所要時間（分）を返す。
 * 将来 Google Maps API 等に差し替える際はこの関数のみ変更する。
 */
export function getEstimatedWalkMinutes(restaurant: Restaurant): number {
  return restaurant.walkMinutes
}

/**
 * 徒歩分数が短い順に TOP3 の飲食店を選定する。
 * 同点の場合は元配列の順序を維持する（安定ソート）。
 */
export function selectRecommendedRestaurantsTop3(
  restaurants: readonly Restaurant[],
): RecommendedRestaurantEntry[] {
  if (restaurants.length === 0) return []

  const indexed = restaurants.map((restaurant, index) => ({
    restaurant,
    index,
    estimatedWalkMinutes: getEstimatedWalkMinutes(restaurant),
  }))

  return indexed
    .sort((a, b) => {
      if (a.estimatedWalkMinutes !== b.estimatedWalkMinutes) {
        return a.estimatedWalkMinutes - b.estimatedWalkMinutes
      }
      return a.index - b.index
    })
    .slice(0, 3)
    .map((entry, i) => ({
      rank: i + 1,
      restaurant: entry.restaurant,
      estimatedWalkMinutes: entry.estimatedWalkMinutes,
    }))
}
