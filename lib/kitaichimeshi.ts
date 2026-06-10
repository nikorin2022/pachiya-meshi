import type { PachinkoHall, Restaurant } from "@/lib/halls/types"

export const KITAICHIMESHI_DESCRIPTION =
  "期待値飯は、パチ屋飯独自基準で選んだ注目度の高い飲食店です。"

export function isKitaichimeshi(restaurant: Restaurant): boolean {
  return restaurant.is_kitaichimeshi === true
}

export function countKitaichimeshi(restaurants: readonly Restaurant[]): number {
  return restaurants.filter(isKitaichimeshi).length
}

export function countKitaichimeshiForHall(hall: PachinkoHall): number {
  return countKitaichimeshi(hall.restaurants)
}

/** ホール向けバッジ文言。期待値飯が0件のときは null */
export function getHallKitaichimeshiLabel(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return "🔥 期待値飯あり"
  return `🔥 期待値飯 ${count}件`
}
