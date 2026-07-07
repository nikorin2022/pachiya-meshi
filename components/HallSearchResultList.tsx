"use client"

import { ChevronRight } from "lucide-react"
import type { HallSearchResult } from "@/lib/hall-search"
import { FavoriteHallButton } from "@/components/FavoriteHallButton"
import { HallCardLink } from "@/components/HallCardLink"

type Props = {
  results: readonly HallSearchResult[]
}

/**
 * ホール検索結果一覧。HallCardLink でトップ・エリアと表示を統一。
 */
export function HallSearchResultList({ results }: Props) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {results.map(({ hall, chainName }) => (
        <li key={hall.id}>
          <HallCardLink
            hall={hall}
            chainName={chainName}
            headerTrailing={
              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                <FavoriteHallButton hallId={hall.id} variant="card" />
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
              </div>
            }
          />
        </li>
      ))}
    </ul>
  )
}
