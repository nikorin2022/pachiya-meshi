import type { PachinkoHall } from "@/lib/halls/types"
import { isKitaichimeshi } from "@/lib/kitaichimeshi"

const GENRE_DISPLAY_LIMIT = 3
const REPRESENTATIVE_RESTAURANT_LIMIT = 2

/**
 * ホールカード用：掲載飲食店のジャンル概要（最大3件 + 「ほか」）。
 * 0件ホールでは null。
 */
export function getHallGenreSummary(hall: PachinkoHall): string | null {
  if (hall.restaurants.length === 0) return null

  const counts = new Map<string, number>()
  for (const restaurant of hall.restaurants) {
    counts.set(restaurant.genre, (counts.get(restaurant.genre) ?? 0) + 1)
  }

  const sortedGenres = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)

  const topGenres = sortedGenres.slice(0, GENRE_DISPLAY_LIMIT)
  const hasMore = sortedGenres.length > GENRE_DISPLAY_LIMIT

  return `主なジャンル：${topGenres.join(" / ")}${hasMore ? " ほか" : ""}`
}

/**
 * ホールカード用：代表飲食店名（期待値飯優先 → 徒歩分が短い順、最大2件）。
 */
export function getRepresentativeRestaurantNames(
  hall: PachinkoHall,
  limit = REPRESENTATIVE_RESTAURANT_LIMIT,
): string[] {
  if (hall.restaurants.length === 0) return []

  return [...hall.restaurants]
    .sort((a, b) => {
      const aKita = isKitaichimeshi(a) ? 0 : 1
      const bKita = isKitaichimeshi(b) ? 0 : 1
      if (aKita !== bKita) return aKita - bKita
      return a.walkMinutes - b.walkMinutes
    })
    .slice(0, limit)
    .map((restaurant) => restaurant.name)
}

/** 代表飲食店名をカード表示用テキストに整形 */
export function formatRepresentativeRestaurants(names: readonly string[]): string | null {
  if (names.length === 0) return null
  return `近くの店：${names.join("、")}`
}
