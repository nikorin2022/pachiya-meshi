import areas from "@/data/areas.json"
import hallsMeta from "@/data/prefectures/tokyo/halls.json"
import type { PachinkoHall } from "@/lib/halls/types"

type AreaRecord = {
  id: string
  name: string
  prefecture: string
}

type HallMetaRecord = {
  id: string
  area_id?: string
}

/** エリアマスタ（将来 /areas /areas/[areaId] で利用） */
export type Area = {
  id: string
  name: string
  prefecture: string
}

const areaRecords = areas as AreaRecord[]
const hallMetaRecords = hallsMeta as HallMetaRecord[]

const areaById = new Map(areaRecords.map((a) => [a.id, a] as const))
const areaByName = new Map(areaRecords.map((a) => [a.name, a] as const))
const hallMetaById = new Map(hallMetaRecords.map((h) => [h.id, h] as const))

export function getAreaById(areaId: string): Area | null {
  const area = areaById.get(areaId)
  return area ?? null
}

export function getAreaByName(areaName: string): Area | null {
  const area = areaByName.get(areaName)
  return area ?? null
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

/** 将来のエリア詳細ページ URL（現時点ではページ未実装） */
export function getAreaPagePath(areaId: string): string {
  return `/areas/${areaId}`
}
