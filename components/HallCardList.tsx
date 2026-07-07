import Link from "next/link"
import { MapPin, Clock, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PachinkoHall } from "@/lib/halls/types"
import { getChainNameForHallId } from "@/lib/hall-search"
import { KitaichimeshiHallBadge } from "@/components/KitaichimeshiBadge"
import {
  countKitaichimeshiForHall,
  getHallKitaichimeshiLabel,
} from "@/lib/kitaichimeshi"

type Props = {
  halls: readonly PachinkoHall[]
  /** カード下部に「周辺の飯を見る」CTAを表示 */
  showMealLink?: boolean
}

/**
 * ホールカード一覧（Server Component）。
 * トップページ・エリア詳細ページで共通利用。
 */
export function HallCardList({ halls, showMealLink = false }: Props) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {halls.map((hall) => {
        const chainName = getChainNameForHallId(hall.id)
        const kitaichimeshiLabel = getHallKitaichimeshiLabel(
          countKitaichimeshiForHall(hall),
        )
        return (
          <li key={hall.id}>
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
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs border-gray-300 text-gray-600"
                    >
                      {chainName ?? "独立店舗"}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base break-words group-hover:text-red-600 transition-colors">
                    {hall.name}
                  </h4>
                </div>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1 group-hover:text-red-500 transition-colors" />
              </div>

              <div className="space-y-1 text-[11px] sm:text-xs text-gray-600">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span className="break-words">{hall.address}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0" />
                  <span>{hall.hours}</span>
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
                <span className="ml-auto text-[10px] sm:text-xs text-gray-500">
                  飲食店 {hall.restaurants.length}件
                </span>
              </div>
              {showMealLink ? (
                <p className="text-[10px] sm:text-xs text-red-600 font-medium mt-2 group-hover:text-red-700">
                  周辺の飯を見る →
                </p>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
