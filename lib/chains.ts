import chains from "@/data/chains.json"
import { hallMetaById } from "@/lib/halls-meta"
import { getAllHalls } from "@/lib/halls"
import { getAreaForHall } from "@/lib/areas"
import type { PachinkoHall } from "@/lib/halls/types"

type ChainRecord = {
  id: string
  name: string
  description_short?: string
  description: string
}

/** チェーンマスタ */
export type Chain = {
  id: string
  name: string
  description_short: string
  description: string
}

export type ChainWithHallCount = Chain & {
  hallCount: number
}

export type ChainDetail = {
  chain: Chain
  halls: PachinkoHall[]
  areaCount: number
}

const chainRecords = chains as ChainRecord[]

const chainById = new Map(chainRecords.map((c) => [c.id, c] as const))

function toChain(record: ChainRecord): Chain {
  return {
    id: record.id,
    name: record.name,
    description_short: record.description_short ?? "",
    description: record.description,
  }
}

export function getChainPagePath(chainId: string): string {
  return `/chains/${chainId}`
}

export function getChainById(chainId: string): Chain | null {
  const chain = chainById.get(chainId)
  return chain ? toChain(chain) : null
}

/** ホールに紐づくチェーンを取得する。独立店舗は null。 */
export function getChainForHall(hall: PachinkoHall): Chain | null {
  const meta = hallMetaById.get(hall.id)
  if (!meta?.chain_id) return null
  return getChainById(meta.chain_id)
}

/** ホール ID からチェーン ID を取得する。独立店舗は null。 */
export function getChainIdForHallId(hallId: string): string | null {
  const meta = hallMetaById.get(hallId)
  return meta?.chain_id ?? null
}

/** 指定チェーンに属するホール一覧 */
export function getHallsByChainId(chainId: string): PachinkoHall[] {
  return getAllHalls().filter((hall) => {
    const meta = hallMetaById.get(hall.id)
    return meta?.chain_id === chainId
  })
}

/** ホールが1件以上紐づくチェーン ID 一覧（SSG 用） */
export function getChainIdsWithHalls(): string[] {
  return getChainsWithHalls().map((chain) => chain.id)
}

/**
 * ホールが紐づいているチェーン一覧（掲載ホール数付き）。
 * data/chains.json の登録順を維持する。
 */
export function getChainsWithHalls(): ChainWithHallCount[] {
  const hallCountByChainId = new Map<string, number>()

  for (const hall of getAllHalls()) {
    const meta = hallMetaById.get(hall.id)
    if (!meta?.chain_id) continue
    hallCountByChainId.set(
      meta.chain_id,
      (hallCountByChainId.get(meta.chain_id) ?? 0) + 1,
    )
  }

  return chainRecords
    .filter((record) => (hallCountByChainId.get(record.id) ?? 0) > 0)
    .map((record) => ({
      ...toChain(record),
      hallCount: hallCountByChainId.get(record.id) ?? 0,
    }))
}

/** チェーン詳細ページ用。存在しない、またはホール0件の場合は null */
export function getChainDetail(chainId: string): ChainDetail | null {
  const chain = getChainById(chainId)
  if (!chain) return null

  const halls = getHallsByChainId(chainId)
  if (halls.length === 0) return null

  const areaIds = new Set<string>()
  for (const hall of halls) {
    const area = getAreaForHall(hall)
    if (area) areaIds.add(area.id)
  }

  return {
    chain,
    halls,
    areaCount: areaIds.size,
  }
}
