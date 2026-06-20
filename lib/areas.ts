import areas from "@/data/areas.json"
import { hallMetaById } from "@/lib/halls-meta"
import { getAllHalls } from "@/lib/halls"
import type { PachinkoHall } from "@/lib/halls/types"

type AreaRecord = {
  id: string
  name: string
  prefecture: string
  description_short: string
  area_description: string
}

/** エリアマスタ */
export type Area = {
  id: string
  name: string
  prefecture: string
  description_short: string
  area_description: string
}

export type AreaWithHallCount = Area & {
  hallCount: number
}

const areaRecords = areas as AreaRecord[]

const areaById = new Map(areaRecords.map((a) => [a.id, a] as const))
const areaByName = new Map(areaRecords.map((a) => [a.name, a] as const))

function toArea(record: AreaRecord): Area {
  return {
    id: record.id,
    name: record.name,
    prefecture: record.prefecture,
    description_short: record.description_short,
    area_description: record.area_description,
  }
}

export function getAreaById(areaId: string): Area | null {
  const area = areaById.get(areaId)
  return area ? toArea(area) : null
}

export function getAreaByName(areaName: string): Area | null {
  const area = areaByName.get(areaName)
  return area ? toArea(area) : null
}

/**
 * ホールに紐づくエリアを取得する。
 * halls.json の area_id を優先し、なければ hall.area（表示名）でマスタを引く。
 */
export function getAreaForHall(hall: PachinkoHall): Area | null {
  const meta = hallMetaById.get(hall.id)
  if (meta?.area_id) {
    return getAreaById(meta.area_id)
  }
  return getAreaByName(hall.area)
}

export function getAreaPagePath(areaId: string): string {
  return `/areas/${areaId}`
}

/** 指定エリアに属するホール一覧 */
export function getHallsByAreaId(areaId: string): PachinkoHall[] {
  return getAllHalls().filter((hall) => getAreaForHall(hall)?.id === areaId)
}

/** ホールが1件以上紐づくエリア ID 一覧（SSG 用） */
export function getAreaIdsWithHalls(): string[] {
  return getAreasWithHalls().map((area) => area.id)
}

/**
 * ホールが紐づいているエリア一覧（掲載ホール数付き）。
 * data/areas.json の登録順を維持する。
 */
export function getAreasWithHalls(): AreaWithHallCount[] {
  const hallCountByAreaId = new Map<string, number>()

  for (const hall of getAllHalls()) {
    const area = getAreaForHall(hall)
    if (!area) continue
    hallCountByAreaId.set(area.id, (hallCountByAreaId.get(area.id) ?? 0) + 1)
  }

  return areaRecords
    .filter((record) => (hallCountByAreaId.get(record.id) ?? 0) > 0)
    .map((record) => ({
      ...toArea(record),
      hallCount: hallCountByAreaId.get(record.id) ?? 0,
    }))
}

/** エリア詳細ページ用。存在しない、またはホール0件の場合は null */
export function getAreaDetail(
  areaId: string,
): { area: Area; halls: PachinkoHall[] } | null {
  const area = getAreaById(areaId)
  if (!area) return null

  const halls = getHallsByAreaId(areaId)
  if (halls.length === 0) return null

  return { area, halls }
}
