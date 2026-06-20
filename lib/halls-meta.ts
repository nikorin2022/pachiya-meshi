import aichiHallsMeta from "@/data/prefectures/aichi/halls.json"
import fukuokaHallsMeta from "@/data/prefectures/fukuoka/halls.json"
import osakaHallsMeta from "@/data/prefectures/osaka/halls.json"
import tokyoHallsMeta from "@/data/prefectures/tokyo/halls.json"

export type HallMetaRecord = {
  id: string
  area_id?: string
  chain_id?: string
}

/** 全都道府県の halls.json メタデータ（area_id / chain_id 解決用） */
export const allHallsMeta: HallMetaRecord[] = [
  ...(tokyoHallsMeta as HallMetaRecord[]),
  ...(osakaHallsMeta as HallMetaRecord[]),
  ...(fukuokaHallsMeta as HallMetaRecord[]),
  ...(aichiHallsMeta as HallMetaRecord[]),
]

export const hallMetaById = new Map(
  allHallsMeta.map((h) => [h.id, h] as const),
)
