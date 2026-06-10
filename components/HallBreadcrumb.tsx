import Link from "next/link"
import { getAreaForHall, getAreaPagePath } from "@/lib/areas"
import type { PachinkoHall } from "@/lib/halls/types"

type Props = {
  hall: PachinkoHall
}

/**
 * ホール詳細ページのパンくずリスト（Server Component）。
 * 表示: ホーム > エリア名 > ホール名
 */
export function HallBreadcrumb({ hall }: Props) {
  const area = getAreaForHall(hall)
  const areaName = area?.name ?? hall.area

  return (
    <nav
      aria-label="パンくずリスト"
      className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap"
    >
      <ol className="inline-flex items-center list-none p-0 m-0">
        <li className="inline-flex items-center">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
        </li>
        <li className="inline-flex items-center" aria-hidden="true">
          <span className="mx-1">&gt;</span>
        </li>
        <li className="inline-flex items-center">
          {area ? (
            <Link href={getAreaPagePath(area.id)} className="hover:text-gray-900">
              {areaName}
            </Link>
          ) : (
            <span>{areaName}</span>
          )}
        </li>
        <li className="inline-flex items-center" aria-hidden="true">
          <span className="mx-1">&gt;</span>
        </li>
        <li className="inline-flex items-center">
          <span className="text-gray-900" aria-current="page">
            {hall.name}
          </span>
        </li>
      </ol>
    </nav>
  )
}
