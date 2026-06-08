import type { PachinkoHall } from "./types"
import { islandAkihabara } from "./island-akihabara"
import { espaceAkihabaraEkimae } from "./espace-akihabara-ekimae"

/**
 * 全ホール登録レジストリ
 *
 * 新ホールを追加する手順:
 *   1. `lib/halls/<slug>.ts` を新規作成し、PachinkoHall 型のオブジェクトを export
 *   2. 下記 `halls` 配列に追加する（この1行追加だけで、ルート・SEO metadata・静的生成が自動で増える）
 */
const halls: readonly PachinkoHall[] = [
  islandAkihabara,
  espaceAkihabaraEkimae,
] as const

/** 全ホール一覧（トップページ用） */
export const getAllHalls = (): readonly PachinkoHall[] => halls

/** URL slug からホールを取得（詳細ページ用） */
export const getHallById = (id: string): PachinkoHall | undefined =>
  halls.find((h) => h.id === id)

/** generateStaticParams で使用する全 ID 配列 */
export const getAllHallIds = (): string[] => halls.map((h) => h.id)
