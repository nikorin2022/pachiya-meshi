import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const baseClassName =
  "bg-orange-50 text-orange-700 border-orange-200 font-medium whitespace-nowrap"

type RestaurantBadgeProps = {
  className?: string
}

/** 飲食店カード用: 🔥 期待値飯 */
export function KitaichimeshiRestaurantBadge({ className }: RestaurantBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(baseClassName, "text-[10px] sm:text-xs px-1.5 py-0", className)}
    >
      🔥 期待値飯
    </Badge>
  )
}

type HallBadgeProps = {
  label: string
  className?: string
}

/** ホールカード・詳細用: 🔥 期待値飯あり / 🔥 期待値飯 N件 */
export function KitaichimeshiHallBadge({ label, className }: HallBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(baseClassName, "text-[10px] sm:text-xs", className)}
    >
      {label}
    </Badge>
  )
}
