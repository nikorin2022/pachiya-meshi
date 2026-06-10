"use client"

import { useMemo } from "react"
import Link from "next/link"
import { MapPin, Clock, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PachinkoHall } from "@/lib/halls/types"
import { getChainNameForHallId } from "@/lib/hall-search"
import { useFavoriteHalls } from "@/components/FavoriteHallsProvider"
import { FavoriteHallButton } from "@/components/FavoriteHallButton"

type Props = {
  halls: readonly PachinkoHall[]
}

/**
 * トップページのお気に入りホール一覧。
 * 0件のときは非表示。
 */
export function FavoriteHallSection({ halls }: Props) {
  const { loaded, favoriteIds } = useFavoriteHalls()

  const favoriteHalls = useMemo(() => {
    if (!loaded || favoriteIds.length === 0) return []
    const hallById = new Map(halls.map((h) => [h.id, h] as const))
    return favoriteIds
      .map((id) => hallById.get(id))
      .filter((hall): hall is PachinkoHall => Boolean(hall))
  }, [loaded, favoriteIds, halls])

  if (!loaded || favoriteHalls.length === 0) return null

  return (
    <section className="mb-4 sm:mb-6">
      <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
        お気に入りホール（{favoriteHalls.length}件）
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {favoriteHalls.map((hall) => {
          const chainName = getChainNameForHallId(hall.id)
          return (
            <li key={hall.id}>
              <div className="relative bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-red-200 transition-all">
                <Link
                  href={`/halls/${hall.id}`}
                  className="group block p-3 sm:p-4 pr-12 sm:pr-14"
                >
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
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-gray-900 text-sm sm:text-base break-words group-hover:text-red-600 transition-colors">
                      {hall.name}
                    </h4>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-0.5 group-hover:text-red-500 transition-colors" />
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
                </Link>
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
                  <FavoriteHallButton hallId={hall.id} variant="card" />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
