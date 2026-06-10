import { getAllHalls } from "@/lib/halls"
import type { PachinkoHall } from "@/lib/halls/types"
import hallsMeta from "@/data/prefectures/tokyo/halls.json"
import chains from "@/data/chains.json"
import areas from "@/data/areas.json"

type HallMeta = {
  id: string
  chain_id?: string
}

type ChainMeta = {
  id: string
  name: string
}

type AreaMeta = {
  id: string
  name: string
}

/** 検索結果1件分（表示用メタデータ付き） */
export type HallSearchResult = {
  hall: PachinkoHall
  chainName: string | null
  chainId: string | null
  areaId: string | null
}

const chainNameById = new Map(
  (chains as ChainMeta[]).map((c) => [c.id, c.name] as const),
)
const areaIdByName = new Map(
  (areas as AreaMeta[]).map((a) => [a.name, a.id] as const),
)
const hallMetaById = new Map(
  (hallsMeta as HallMeta[]).map((h) => [h.id, h] as const),
)

/** ホールのチェーン名を取得する。独立店舗は null。 */
export function getChainNameForHallId(hallId: string): string | null {
  const meta = hallMetaById.get(hallId)
  if (!meta?.chain_id) return null
  return chainNameById.get(meta.chain_id) ?? null
}

/**
 * 検索キーワードを比較用に正規化する。
 * - trim
 * - NFKC（全角英数・記号の半角化）
 * - 全角スペースを除去対象に含める
 * - 連続空白を除去（スペース有無のゆらぎ吸収）
 * - 小文字化
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase()
}

function buildSearchHaystack(result: HallSearchResult): string {
  const { hall, chainName, chainId, areaId } = result
  return normalizeSearchText(
    [hall.name, hall.id, hall.area, areaId, chainName, chainId]
      .filter((v): v is string => Boolean(v))
      .join(" "),
  )
}

let cachedIndex: HallSearchResult[] | null = null

function getHallSearchIndex(): HallSearchResult[] {
  if (cachedIndex) return cachedIndex

  cachedIndex = getAllHalls().map((hall) => {
    const meta = hallMetaById.get(hall.id)
    const chainId = meta?.chain_id ?? null
    const chainName = chainId ? (chainNameById.get(chainId) ?? null) : null
    const areaId = areaIdByName.get(hall.area) ?? null

    return { hall, chainName, chainId, areaId }
  })

  return cachedIndex
}

/**
 * ホール名・hall_id・エリア名・チェーン名で部分一致検索する。
 * 空文字・空白のみの場合は空配列を返す。
 */
export function searchHalls(rawQuery: string): HallSearchResult[] {
  const query = rawQuery.trim()
  if (!query) return []

  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  return getHallSearchIndex().filter((entry) => {
    const haystack = buildSearchHaystack(entry)
    return haystack.includes(normalizedQuery)
  })
}
