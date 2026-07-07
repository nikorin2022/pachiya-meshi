import Link from "next/link"
import { MapPin, Clock, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import type { PachinkoHall } from "@/lib/halls/types"
import {
  formatRepresentativeRestaurants,
  getHallGenreSummary,
  getRepresentativeRestaurantNames,
} from "@/lib/hall-card-summary"
import { KitaichimeshiHallBadge } from "@/components/KitaichimeshiBadge"
import {
  countKitaichimeshiForHall,
  getHallKitaichimeshiLabel,
} from "@/lib/kitaichimeshi"

type Props = {
  hall: PachinkoHall
  chainName?: string | null
  /** チェーン名バッジを表示する（検索・エリア・トップで統一） */
  showChainBadge?: boolean
  /** ヘッダー右側（お気に入りボタン等） */
  headerTrailing?: ReactNode
  /** 下部CTAを表示する */
  showMealLink?: boolean
}

/**
 * ホール詳細へのリンクカード（Server / Client 両方から利用可）。
 * トップ・検索・エリアページで表示を統一する。
 */
export function HallCardLink({
  hall,
  chainName = null,
  showChainBadge = true,
  headerTrailing,
  showMealLink = true,
}: Props) {
  const kitaichimeshiCount = countKitaichimeshiForHall(hall)
  const kitaichimeshiLabel = getHallKitaichimeshiLabel(kitaichimeshiCount)
  const genreSummary = getHallGenreSummary(hall)
  const representativeText = formatRepresentativeRestaurants(
    getRepresentativeRestaurantNames(hall),
  )

  return (
    <Link
      href={`/halls/${hall.id}`}
      className="group block bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md hover:border-red-200 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Badge
              variant="outline"
              className="bg-red-50 text-red-600 border-red-200 text-[10px] sm:text-xs"
            >
              {hall.prefecture}・{hall.area}
            </Badge>
            {showChainBadge ? (
              <Badge
                variant="outline"
                className="text-[10px] sm:text-xs border-gray-300 text-gray-600"
              >
                {chainName ?? "独立店舗"}
              </Badge>
            ) : null}
          </div>
          <h4 className="font-bold text-gray-900 text-sm sm:text-base break-words group-hover:text-red-600 transition-colors">
            {hall.name}
          </h4>
        </div>
        {headerTrailing ?? (
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1 group-hover:text-red-500 transition-colors" />
        )}
      </div>

      {(genreSummary || representativeText) && hall.restaurants.length > 0 ? (
        <div className="space-y-0.5 mb-2 text-[10px] sm:text-xs text-gray-600">
          {genreSummary ? (
            <p className="line-clamp-2 break-words">{genreSummary}</p>
          ) : null}
          {representativeText ? (
            <p className="line-clamp-2 break-words">{representativeText}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1 text-[11px] sm:text-xs text-gray-600">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0 mt-0.5" />
          <span className="break-words line-clamp-2">{hall.address}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0" />
          <span className="line-clamp-1">{hall.hours}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-300">
          パチンコ {hall.pachinko}台
        </Badge>
        <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-300">
          スロット {hall.slot}台
        </Badge>
        {kitaichimeshiLabel ? (
          <KitaichimeshiHallBadge
            label={kitaichimeshiLabel}
            className="text-[10px] sm:text-xs"
          />
        ) : null}
        <span className="ml-auto text-[10px] sm:text-xs text-gray-500 shrink-0">
          飲食店 {hall.restaurants.length}件
        </span>
      </div>

      {showMealLink ? (
        <p className="text-[10px] sm:text-xs text-red-600 font-medium mt-2 group-hover:text-red-700">
          周辺の飯を見る →
        </p>
      ) : null}
    </Link>
  )
}
