import type { PachinkoHall, Restaurant as GeneratedRestaurant } from "../../lib/halls/types"
import { HallBuilder, type LegacyRestaurant } from "../lib/hall-builder"
import { MasterResolver } from "../lib/master-resolver"
import { RestaurantMatcher } from "../lib/restaurant-matcher"
import type { HallInput, RestaurantInput } from "../lib/schema"
import { getHallLocations, getRestaurantLocations, type EntityLocation, type LocatedEntity } from "./rule-utils"
import type { AuditData } from "./types"

export type GeneratedRestaurantResolutionReason =
  | "generated_hall_source_unresolved"
  | "source_generated_id_unresolvable"
  | "generated_restaurant_identity_mismatch"
  | "generated_restaurant_source_unresolved"
  | "generated_restaurant_source_ambiguous"

export type GeneratedRestaurantResolution = {
  readonly restaurant: RestaurantInput | null
  readonly location: EntityLocation | null
  readonly prefectureFile: string | null
  readonly mismatchedFields: readonly string[]
  readonly reason: GeneratedRestaurantResolutionReason | null
}

export type SourceGeneratedPairResolution = {
  readonly restaurant: RestaurantInput | null
  readonly location: EntityLocation | null
  readonly prefectureFile: string | null
  readonly generatedRestaurantId: number | null
  readonly reason: GeneratedRestaurantResolutionReason | null
}

export type GeneratedRestaurantResolver = {
  resolve(hall: Pick<PachinkoHall, "id" | "prefecture">, generated: GeneratedRestaurant): GeneratedRestaurantResolution
  resolveSourcePair(hallId: string, restaurantId: string): SourceGeneratedPairResolution
}

type BuiltPair = {
  readonly hall: LocatedEntity<HallInput>
  readonly restaurant: LocatedEntity<RestaurantInput>
  readonly generated: LegacyRestaurant
}

/**
 * 生成処理と同じ HallBuilder を通して、生成数値IDと正本restaurantを対応付ける。
 * 監査側で match の配列順からIDを推測しない。
 */
export function createGeneratedRestaurantResolver(data: AuditData): GeneratedRestaurantResolver {
  const hallEntries = getHallLocations(data)
  const restaurantEntries = getRestaurantLocations(data)
  const hallById = new Map(hallEntries.map((entry) => [entry.entity.id, entry]))
  const restaurantBySourceKey = new Map(restaurantEntries.map((entry) => [sourcePairKey(entry.location.prefecture, entry.entity.id), entry]))
  const builtByGeneratedKey = new Map<string, BuiltPair[]>()
  const builtByHallId = new Map<string, BuiltPair[]>()
  const builtBySourceKey = new Map<string, BuiltPair>()
  const buildFailureByHallId = new Set<string>()
  const builder = new HallBuilder(
    MasterResolver.fromMasters([...data.areas], [...data.chains]),
    [...data.aiSummaryOverrides],
  )

  for (const hall of hallEntries) {
    const prefectureFile = hall.location.prefecture
    if (!prefectureFile) {
      buildFailureByHallId.add(hall.entity.id)
      continue
    }
    const restaurants = data.restaurantsByPrefecture.get(prefectureFile) ?? []
    try {
      const matches = new RestaurantMatcher(
        [...restaurants],
        [...data.walkMinutesOverrides],
        [...data.exclusions],
      ).matchForHall(hall.entity)
      const generatedRestaurants = builder.build(hall.entity, matches).restaurants
      for (const [index, generated] of generatedRestaurants.entries()) {
        const match = matches[index]
        if (!match) continue
        const restaurant = restaurantBySourceKey.get(sourcePairKey(prefectureFile, match.restaurant.id))
        if (!restaurant) continue
        const pair: BuiltPair = { hall, restaurant, generated }
        const generatedKey = generatedPairKey(hall.entity.id, generated.id)
        const grouped = builtByGeneratedKey.get(generatedKey)
        if (grouped) grouped.push(pair)
        else builtByGeneratedKey.set(generatedKey, [pair])
        const hallPairs = builtByHallId.get(hall.entity.id)
        if (hallPairs) hallPairs.push(pair)
        else builtByHallId.set(hall.entity.id, [pair])
        builtBySourceKey.set(sourcePairKey(hall.entity.id, match.restaurant.id), pair)
      }
    } catch {
      buildFailureByHallId.add(hall.entity.id)
    }
  }

  return {
    resolve(hall, generated) {
      const sourceHall = hallById.get(hall.id)
      if (!sourceHall) return unresolved("generated_hall_source_unresolved")
      if (buildFailureByHallId.has(hall.id)) return unresolved("source_generated_id_unresolvable")

      const candidates = stableBuiltPairs(builtByGeneratedKey.get(generatedPairKey(hall.id, generated.id)) ?? [])
      if (candidates.length === 1) return resolveBuiltPair(candidates[0], generated)
      if (candidates.length > 1) return unresolved("generated_restaurant_source_ambiguous")

      // A legacy ID is a source-defined identity and can be used directly.  A
      // restaurant without one is never matched from a guessed ordinal here.
      const prefectureFile = sourceHall.location.prefecture
      const legacyCandidates = prefectureFile
        ? stableRestaurantEntries((data.restaurantsByPrefecture.get(prefectureFile) ?? [])
          .filter((restaurant) => restaurant.legacy_id === generated.id)
          .map((restaurant) => restaurantBySourceKey.get(sourcePairKey(prefectureFile, restaurant.id)))
          .filter((entry): entry is LocatedEntity<RestaurantInput> => entry !== undefined))
        : []
      if (legacyCandidates.length === 1) {
        const candidate = legacyCandidates[0]
        return {
          restaurant: candidate.entity,
          location: candidate.location,
          prefectureFile: candidate.location.prefecture,
          mismatchedFields: mismatchedSourceFields(candidate.entity, generated),
          reason: "generated_restaurant_identity_mismatch",
        }
      }
      if (legacyCandidates.length > 1) return unresolved("generated_restaurant_source_ambiguous")
      const unversionedCandidates = stableBuiltPairs(builtByHallId.get(hall.id) ?? [])
        .filter((pair) => pair.restaurant.entity.legacy_id === undefined)
        .filter((pair) => mismatchedGeneratedFields(pair.generated, generated).every((field) => field === "id"))
      if (unversionedCandidates.length === 1) {
        const candidate = unversionedCandidates[0]
        return {
          restaurant: candidate.restaurant.entity,
          location: candidate.restaurant.location,
          prefectureFile: candidate.restaurant.location.prefecture,
          mismatchedFields: ["id"],
          reason: "source_generated_id_unresolvable",
        }
      }
      if (unversionedCandidates.length > 1) return unresolved("generated_restaurant_source_ambiguous")
      return unresolved("generated_restaurant_source_unresolved")
    },
    resolveSourcePair(hallId, restaurantId) {
      const sourceHall = hallById.get(hallId)
      if (!sourceHall) return sourceUnresolved("generated_hall_source_unresolved")
      if (buildFailureByHallId.has(hallId)) return sourceUnresolved("source_generated_id_unresolvable")
      const built = builtBySourceKey.get(sourcePairKey(hallId, restaurantId))
      if (built) {
        return {
          restaurant: built.restaurant.entity,
          location: built.restaurant.location,
          prefectureFile: built.restaurant.location.prefecture,
          generatedRestaurantId: built.generated.id,
          reason: null,
        }
      }
      const prefectureFile = sourceHall.location.prefecture
      const source = prefectureFile ? restaurantBySourceKey.get(sourcePairKey(prefectureFile, restaurantId)) : undefined
      if (!source) return sourceUnresolved("generated_restaurant_source_unresolved")
      if (source.entity.legacy_id === undefined) return sourceUnresolved("source_generated_id_unresolvable")
      return {
        restaurant: source.entity,
        location: source.location,
        prefectureFile: source.location.prefecture,
        generatedRestaurantId: source.entity.legacy_id,
        reason: null,
      }
    },
  }
}

function resolveBuiltPair(pair: BuiltPair, generated: GeneratedRestaurant): GeneratedRestaurantResolution {
  const mismatchedFields = mismatchedGeneratedFields(pair.generated, generated)
  return {
    restaurant: pair.restaurant.entity,
    location: pair.restaurant.location,
    prefectureFile: pair.restaurant.location.prefecture,
    mismatchedFields,
    reason: mismatchedFields.length === 0 ? null : "generated_restaurant_identity_mismatch",
  }
}

function mismatchedGeneratedFields(expected: LegacyRestaurant, generated: GeneratedRestaurant): readonly string[] {
  const mismatches: string[] = []
  if (expected.id !== generated.id) mismatches.push("id")
  if (!sameText(expected.name, generated.name)) mismatches.push("name")
  if (!sameText(expected.address, generated.address)) mismatches.push("address")
  if (!Object.is(expected.lat, generated.lat)) mismatches.push("lat")
  if (!Object.is(expected.lng, generated.lng)) mismatches.push("lng")
  if (expected.genre !== generated.genre) mismatches.push("genre")
  if (expected.walkMinutes !== generated.walkMinutes) mismatches.push("walkMinutes")
  if (!sameStringArray(expected.time_category, generated.time_category)) mismatches.push("time_category")
  if (!sameText(expected.hours, generated.hours)) mismatches.push("hours")
  if (!sameText(expected.ai_summary, generated.ai_summary)) mismatches.push("ai_summary")
  if (!sameStringArray(expected.tags, generated.tags)) mismatches.push("tags")
  if ((expected.is_kitaichimeshi ?? false) !== (generated.is_kitaichimeshi ?? false)) mismatches.push("is_kitaichimeshi")
  return mismatches
}

function mismatchedSourceFields(source: RestaurantInput, generated: GeneratedRestaurant): readonly string[] {
  const mismatches: string[] = []
  if (source.legacy_id !== generated.id) mismatches.push("legacy_id")
  if (!sameText(source.name, generated.name)) mismatches.push("name")
  if (!sameText(source.address, generated.address)) mismatches.push("address")
  if (!Object.is(source.lat, generated.lat)) mismatches.push("lat")
  if (!Object.is(source.lng, generated.lng)) mismatches.push("lng")
  if (source.genre !== generated.genre) mismatches.push("genre")
  if (!sameStringArray(source.time_category, generated.time_category)) mismatches.push("time_category")
  if (!sameText(source.hours, generated.hours)) mismatches.push("hours")
  if (!sameStringArray(source.tags, generated.tags)) mismatches.push("tags")
  if ((source.is_kitaichimeshi ?? false) !== (generated.is_kitaichimeshi ?? false)) mismatches.push("is_kitaichimeshi")
  return mismatches
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => sameText(value, right[index] ?? ""))
}

function sameText(left: string, right: string): boolean {
  return left === right || left.normalize("NFKC").trim() === right.normalize("NFKC").trim()
}

function stableBuiltPairs(pairs: readonly BuiltPair[]): readonly BuiltPair[] {
  return [...pairs].sort((left, right) =>
    left.restaurant.location.file.localeCompare(right.restaurant.location.file) ||
    left.restaurant.location.index - right.restaurant.location.index ||
    left.restaurant.entity.id.localeCompare(right.restaurant.entity.id),
  )
}

function stableRestaurantEntries(entries: readonly LocatedEntity<RestaurantInput>[]): readonly LocatedEntity<RestaurantInput>[] {
  return [...entries].sort((left, right) =>
    left.location.file.localeCompare(right.location.file) ||
    left.location.index - right.location.index ||
    left.entity.id.localeCompare(right.entity.id),
  )
}

function unresolved(reason: GeneratedRestaurantResolutionReason): GeneratedRestaurantResolution {
  return { restaurant: null, location: null, prefectureFile: null, mismatchedFields: [], reason }
}

function sourceUnresolved(reason: GeneratedRestaurantResolutionReason): SourceGeneratedPairResolution {
  return { restaurant: null, location: null, prefectureFile: null, generatedRestaurantId: null, reason }
}

function generatedPairKey(hallId: string, restaurantId: number): string {
  return `${hallId}|${restaurantId}`
}

function sourcePairKey(left: string | null, right: string): string {
  return `${left ?? ""}|${right}`
}
