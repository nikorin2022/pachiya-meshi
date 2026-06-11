"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { MapPin, Clock, ChevronRight, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FavoriteHallSection } from "@/components/FavoriteHallSection"
import { FavoriteHallButton } from "@/components/FavoriteHallButton"
import type { PachinkoHall } from "@/lib/halls/types"
import { KitaichimeshiHallBadge } from "@/components/KitaichimeshiBadge"
import {
  countKitaichimeshiForHall,
  getHallKitaichimeshiLabel,
} from "@/lib/kitaichimeshi"

type Props = {
  halls: readonly PachinkoHall[]
}

function normalize(text: string): string {
  return text.replace(/\u3000/g, " ").trim().toLowerCase()
}

/**
 * トップページのホール検索 UI（Client Component）。
 *
 * 初期状態では一覧を出さず、キーワード入力後に検索結果のみ表示する。
 * 目的は全件一覧ではなく、目的のホールを探す導線にすること。
 */
export default function HallListClient({ halls }: Props) {
  const [query, setQuery] = useState("")

  const filteredHalls = useMemo(() => {
    const q = normalize(query)
    if (!q) return []

    return halls.filter((hall) => {
      const haystack = normalize(
        [hall.name, hall.area, hall.address, hall.prefecture, hall.city].join(" "),
      )
      return haystack.includes(q)
    })
  }, [halls, query])

  const hasQuery = query.trim().length > 0
  const resultCount = filteredHalls.length

  return (
    <>
      <section id="halls" className="mb-4 sm:mb-6 scroll-mt-20">
        <h2 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
          ホール検索
        </h2>
        <label htmlFor="hall-search" className="sr-only">
          ホールを検索
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
          <Input
            id="hall-search"
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ホール名・エリア・住所で検索（例：アイランド / 秋葉原）"
            className="h-12 pl-10 pr-10 text-base bg-white border-gray-300 focus-visible:border-red-400 focus-visible:ring-red-200/60"
            autoComplete="off"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="検索条件をクリア"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!hasQuery ? (
          <p className="text-[11px] sm:text-xs text-gray-600 mt-3">
            掲載中のホールは{halls.length}件です。ホール名・エリア・住所で検索してください。
          </p>
        ) : null}
      </section>

      <FavoriteHallSection halls={halls} />

      {hasQuery ? (
        <section>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
            検索結果（{resultCount}件 / 全{halls.length}件）
          </h3>

          {resultCount === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base font-bold text-gray-900 mb-1">
                該当するホールが見つかりません
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                キーワードを変えるか、検索条件をクリアしてください。
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 inline-flex items-center gap-1.5 text-xs sm:text-sm text-red-600 hover:text-red-700 font-bold"
              >
                <X className="w-3.5 h-3.5" />
                検索条件をクリア
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredHalls.map((hall) => {
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
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-600 border-red-200 text-[10px] sm:text-xs mb-1.5"
                          >
                            {hall.prefecture}・{hall.area}
                          </Badge>
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base break-words group-hover:text-red-600 transition-colors">
                            {hall.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                          <FavoriteHallButton hallId={hall.id} variant="card" />
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
                        </div>
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
                        <Badge
                          variant="outline"
                          className="text-[10px] sm:text-xs border-gray-300"
                        >
                          パチンコ {hall.pachinko}台
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] sm:text-xs border-gray-300"
                        >
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
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </>
  )
}
