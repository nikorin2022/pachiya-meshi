import { cn } from "@/lib/utils"
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

const restaurantCardBaseClassName =
  "rounded-lg overflow-hidden transition-shadow scroll-mt-24"

/** ホール詳細の飲食店カード用クラス */
export function getRestaurantCardClassName(kitaichimeshi: boolean): string {
  return cn(
    restaurantCardBaseClassName,
    kitaichimeshi
      ? "bg-orange-50 border border-orange-200 shadow-md hover:shadow-md"
      : "bg-white border border-gray-200 shadow-sm hover:shadow-md",
  )
}

/** おすすめ店舗TOP3の期待値飯アイテム用クラス */
export function getRecommendedRestaurantItemClassName(
  kitaichimeshi: boolean,
): string {
  return cn(
    "flex items-center gap-2 sm:gap-3 shrink-0 min-w-[200px] lg:min-w-0 transition-opacity",
    kitaichimeshi
      ? "rounded-lg border border-orange-200 bg-orange-50 p-2 sm:p-2.5 shadow-sm hover:opacity-90"
      : "hover:opacity-80",
  )
}
