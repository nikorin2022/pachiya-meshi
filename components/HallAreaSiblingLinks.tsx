import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { Area } from "@/lib/areas"
import { getAreaPagePath } from "@/lib/areas"
import type { PachinkoHall } from "@/lib/halls/types"

type Props = {
  area: Area | null
  siblingHalls: readonly PachinkoHall[]
  title?: string
}

/**
 * 同エリアの他ホール、またはエリア一覧への導線。
 * 0件・少数掲載ホール詳細で使用。
 */
export function HallAreaSiblingLinks({
  area,
  siblingHalls,
  title = "同じエリアの他ホール",
}: Props) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
        {title}
      </h3>

      {siblingHalls.length > 0 ? (
        <ul className="space-y-2 sm:space-y-3">
          {siblingHalls.map((sibling) => (
            <li key={sibling.id}>
              <Link
                href={`/halls/${sibling.id}`}
                className="group flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 hover:border-red-200 hover:bg-red-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors break-words">
                    {sibling.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    {sibling.prefecture}・{sibling.area} / 飲食店{" "}
                    {sibling.restaurants.length}件
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-600 font-medium mt-1.5">
                    このホール周辺の飯を見る
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 group-hover:text-red-500 transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs sm:text-sm text-gray-600 mb-3">
          同エリアの他ホール情報はエリア一覧からご確認ください。
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-[10px] sm:text-xs">
        {area ? (
          <Link
            href={getAreaPagePath(area.id)}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            {area.name}のエリアページへ
          </Link>
        ) : null}
        <Link href="/areas" className="text-red-600 hover:text-red-700 font-medium">
          エリア一覧を見る
        </Link>
      </div>
    </section>
  )
}
