import type { PachinkoHall } from "@/lib/halls/types"
import { getChainNameForHallId } from "@/lib/hall-search"
import { HallCardLink } from "@/components/HallCardLink"

type Props = {
  halls: readonly PachinkoHall[]
  /** カード下部に「周辺の飯を見る」CTAを表示 */
  showMealLink?: boolean
}

/**
 * ホールカード一覧（Server Component）。
 * トップページ・エリア詳細ページで共通利用。
 */
export function HallCardList({ halls, showMealLink = true }: Props) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {halls.map((hall) => (
        <li key={hall.id}>
          <HallCardLink
            hall={hall}
            chainName={getChainNameForHallId(hall.id)}
            showMealLink={showMealLink}
          />
        </li>
      ))}
    </ul>
  )
}
