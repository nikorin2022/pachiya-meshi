import type { Area, Chain, HallInput, RestaurantInput } from "../lib/schema"
import type { AuditData } from "./types"

export type EntityLocation = {
  readonly entityId: string | null
  readonly file: string
  readonly prefecture: string | null
  readonly index: number
}

export type LocatedEntity<T> = {
  readonly entity: T
  readonly location: EntityLocation
}

export function getAreaLocations(data: AuditData): readonly LocatedEntity<Area>[] {
  return data.areas.map((entity, index) => ({
    entity,
    location: {
      entityId: entity.id,
      file: "data/areas.json",
      prefecture: entity.prefecture || null,
      index,
    },
  }))
}

export function getChainLocations(data: AuditData): readonly LocatedEntity<Chain>[] {
  return data.chains.map((entity, index) => ({
    entity,
    location: {
      entityId: entity.id,
      file: "data/chains.json",
      prefecture: null,
      index,
    },
  }))
}

export function getHallLocations(data: AuditData): readonly LocatedEntity<HallInput>[] {
  return data.prefectures.flatMap((prefecture) =>
    (data.hallsByPrefecture.get(prefecture) ?? []).map((entity, index) => ({
      entity,
      location: {
        entityId: entity.id,
        file: `data/prefectures/${prefecture}/halls.json`,
        prefecture,
        index,
      },
    })),
  )
}

export function getRestaurantLocations(
  data: AuditData,
): readonly LocatedEntity<RestaurantInput>[] {
  return data.prefectures.flatMap((prefecture) =>
    (data.restaurantsByPrefecture.get(prefecture) ?? []).map((entity, index) => ({
      entity,
      location: {
        entityId: entity.id,
        file: `data/prefectures/${prefecture}/restaurants.json`,
        prefecture,
        index,
      },
    })),
  )
}

export function groupBy<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const key = keyOf(value)
    const current = groups.get(key)
    if (current) current.push(value)
    else groups.set(key, [value])
  }
  return groups
}

export function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0
}

export function sortLocations(
  locations: readonly EntityLocation[],
): readonly EntityLocation[] {
  return [...locations].sort((a, b) =>
    compareStrings(a.file, b.file) ||
    a.index - b.index ||
    compareStrings(a.entityId ?? "", b.entityId ?? ""),
  )
}

export function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareStrings)
}

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
