import { estimateWalkMinutes, haversineMeters } from "../lib/distance"
import { RestaurantMatcher, type MatchedRestaurant } from "../lib/restaurant-matcher"
import type { HallInput, RestaurantInput } from "../lib/schema"
import { WalkMinutesOverrideSchema } from "../lib/schema"
import type { PachinkoHall, Restaurant as GeneratedRestaurant } from "../../lib/halls/types"
import { PREFECTURE_BOUNDING_BOXES, type PrefectureBoundingBox } from "./geo-config"
import { getGeneratedHallsSnapshot } from "./generated-snapshot"
import { createAuditIssue } from "./report"
import {
  compareStrings,
  getHallLocations,
  getRestaurantLocations,
  groupBy,
  sortLocations,
  sortedUnique,
  type EntityLocation,
  type LocatedEntity,
} from "./rule-utils"
import { normalizeComparableName, normalizeComparableText } from "./text-similarity"
import type { AuditData, AuditIssue } from "./types"
import { createGeneratedRestaurantResolver, type GeneratedRestaurantResolution } from "./generated-pair-resolver"

export const GEO_RULE_CODES = [
  "RESTAURANT_COORD_MISSING",
  "RESTAURANT_COORD_FORMAT",
  "RESTAURANT_COORD_OUTSIDE_PREFECTURE",
  "RESTAURANT_COORD_DUPLICATE",
  "RESTAURANT_DISTANCE_ABNORMAL",
  "RESTAURANT_WALK_OUTSIDE_SUSPECTED",
  "RESTAURANT_MAP_URL_INVALID",
] as const

export const GEO_RULE_COUNT = GEO_RULE_CODES.length

type RestaurantEntry = LocatedEntity<RestaurantInput>

type ExpectedPair = {
  readonly key: string
  readonly prefectureFile: string
  readonly hall: HallInput
  readonly restaurant: RestaurantInput
  readonly generatedRestaurantId: number
  readonly match: MatchedRestaurant
  readonly location: EntityLocation
  readonly hasWalkOverride: boolean
  readonly isExcluded: boolean
  readonly baseIncluded: boolean
  readonly finalIncluded: boolean
}

/** S1-05 の座標と生成物整合性を、既存matcher・距離関数の結果で検査する。 */
export function checkGeo(
  data: AuditData,
  generatedHalls: readonly PachinkoHall[] = getGeneratedHallsSnapshot(),
): readonly AuditIssue[] {
  const restaurants = getRestaurantLocations(data)
  return [
    ...checkRestaurantCoordinates(data, restaurants),
    ...checkGeneratedDistanceAndWalk(data, generatedHalls),
  ]
}

function checkRestaurantCoordinates(
  data: AuditData,
  entries: readonly RestaurantEntry[],
): readonly AuditIssue[] {
  const valid: RestaurantEntry[] = []
  const issues: AuditIssue[] = []
  for (const entry of entries) {
    const { entity: restaurant, location } = entry
    const lat = restaurant.lat as unknown
    const lng = restaurant.lng as unknown
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      issues.push(createCoordinateIssue("RESTAURANT_COORD_MISSING", "error", restaurant, location, {
        lat: coordinateDetailValue(lat), lng: coordinateDetailValue(lng), reason: "missing_coordinate",
      }))
      continue
    }
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      issues.push(createCoordinateIssue("RESTAURANT_COORD_FORMAT", "error", restaurant, location, {
        lat: coordinateDetailValue(lat), lng: coordinateDetailValue(lng), reason: "not_finite_number",
      }))
      continue
    }
    if (lat >= 122 && lat <= 154 && lng >= 24 && lng <= 46) {
      issues.push(createCoordinateIssue("RESTAURANT_COORD_FORMAT", "error", restaurant, location, {
        lat, lng, reason: "japan_range_swapped",
      }))
      continue
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || lat < 24 || lat > 46 || lng < 122 || lng > 154) {
      issues.push(createCoordinateIssue("RESTAURANT_COORD_FORMAT", "error", restaurant, location, {
        lat, lng, reason: "outside_japan_range",
      }))
      continue
    }
    valid.push(entry)
  }
  return [
    ...issues,
    ...checkOutsidePrefecture(data, valid),
    ...checkCoordinateDuplicates(valid, 6),
    ...checkCoordinateDuplicates(valid, 4),
  ]
}

function createCoordinateIssue(
  code: "RESTAURANT_COORD_MISSING" | "RESTAURANT_COORD_FORMAT",
  severity: "error",
  restaurant: RestaurantInput,
  location: EntityLocation,
  details: { readonly lat: string | number | boolean | null; readonly lng: string | number | boolean | null; readonly reason: string },
): AuditIssue {
  return createAuditIssue({
    code,
    severity,
    entityType: "restaurant",
    entityId: restaurant.id,
    file: location.file,
    message: code === "RESTAURANT_COORD_MISSING" ? "飲食店座標が設定されていません" : "飲食店座標の形式または範囲が不正です",
    details: { ...details, location },
    autoFixable: false,
  })
}

function checkOutsidePrefecture(
  data: AuditData,
  entries: readonly RestaurantEntry[],
): readonly AuditIssue[] {
  return entries.flatMap(({ entity: restaurant, location }) => {
    const prefectureLabel = resolvePrefectureLabel(data, location.prefecture)
    const boundingBox = prefectureLabel ? PREFECTURE_BOUNDING_BOXES.get(prefectureLabel) : undefined
    if (!boundingBox || isInsideBoundingBox(restaurant.lat, restaurant.lng, boundingBox)) return []
    return [
      createAuditIssue({
        code: "RESTAURANT_COORD_OUTSIDE_PREFECTURE",
        severity: "warning",
        entityType: "restaurant",
        entityId: restaurant.id,
        file: location.file,
        message: "飲食店座標が都道府県の粗い想定範囲外です",
        details: {
          lat: restaurant.lat,
          lng: restaurant.lng,
          prefectureFile: location.prefecture,
          prefectureLabel,
          boundingBox,
          location,
        },
        autoFixable: false,
      }),
    ]
  })
}

function checkCoordinateDuplicates(
  entries: readonly RestaurantEntry[],
  precision: 4 | 6,
): readonly AuditIssue[] {
  return [...groupBy(entries, ({ entity }) => coordinateKey(entity.lat, entity.lng, precision)).entries()]
    .filter(([, group]) => {
      if (precision === 4) {
        if (group.length < 3) return false
        return new Set(group.map(({ entity }) => coordinateKey(entity.lat, entity.lng, 6))).size > 1
      }
      const restaurantIds = new Set(group.map(({ entity }) => entity.id))
      const names = new Set(group.map(({ entity }) => normalizeComparableName(entity.name)))
      const addresses = new Set(group.map(({ entity }) => normalizeComparableText(entity.address)))
      return restaurantIds.size > 1 && (names.size > 1 || addresses.size > 1)
    })
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([coordinate, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code: "RESTAURANT_COORD_DUPLICATE",
        severity: "warning",
        entityType: "restaurant",
        entityId: null,
        file: locations[0]?.file ?? null,
        message: precision === 6
          ? "異なる飲食店で座標が完全に一致しています"
          : "3件以上の飲食店で小数4桁に丸めた座標が近接しています",
        details: {
          coordinate,
          precision,
          occurrenceCount: locations.length,
          restaurantIds: locations.map((location) => location.entityId ?? ""),
          names: sortedUnique(group.map(({ entity }) => normalizeComparableName(entity.name))),
          addresses: sortedUnique(group.map(({ entity }) => normalizeComparableText(entity.address))),
          locations,
        },
        autoFixable: false,
      })
    })
}

function checkGeneratedDistanceAndWalk(
  data: AuditData,
  generatedHalls: readonly PachinkoHall[],
): readonly AuditIssue[] {
  const resolver = createGeneratedRestaurantResolver(data)
  const expectedResult = calculateExpectedPairs(data, resolver)
  const actualResult = collectActualPairs(data, generatedHalls, resolver)
  const expected = expectedResult.pairs
  const actual = actualResult.pairs
  const issues: AuditIssue[] = [...expectedResult.issues, ...actualResult.issues]

  for (const pair of [...expected.values()].sort((a, b) => compareStrings(a.key, b.key))) {
    const generatedKey = generatedPairKey(pair.hall.id, pair.generatedRestaurantId)
    if (actualResult.duplicateKeys.has(generatedKey)) continue
    const generated = actual.get(generatedKey)
    if (!generated) {
      issues.push(createPairIssue("RESTAURANT_DISTANCE_ABNORMAL", "error", pair, null, "expected_pair_missing_generated"))
      continue
    }
    if (generated.resolution.reason) {
      issues.push(createResolutionIssue(data, generated, generated.resolution))
      continue
    }
    if (generated.restaurant.walkMinutes !== pair.match.walkMinutes) {
      issues.push(createPairIssue("RESTAURANT_DISTANCE_ABNORMAL", "error", pair, generated.restaurant, "generated_walk_minutes_mismatch"))
    }
    if (!isValidWalkMinutes(generated.restaurant.walkMinutes)) {
      issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "error", pair, generated.restaurant, "generated_walk_minutes_outside_contract"))
    }
  }

  for (const [key, generated] of [...actual.entries()].sort(([a], [b]) => compareStrings(a, b))) {
    if (expected.has(key) || expectedResult.duplicateKeys.has(key)) continue
    if (generated.resolution.reason) issues.push(createResolutionIssue(data, generated, generated.resolution))
    else issues.push(createActualOnlyIssue("RESTAURANT_DISTANCE_ABNORMAL", generated, data, "unexpected_generated_pair"))
    if (!isValidWalkMinutes(generated.restaurant.walkMinutes)) {
      issues.push(createActualOnlyIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", generated, data, "generated_walk_minutes_outside_contract"))
    }
  }

  issues.push(...checkOverridesAndExclusions(data, actual, resolver))
  return issues
}

function calculateExpectedPairs(
  data: AuditData,
  resolver: ReturnType<typeof createGeneratedRestaurantResolver>,
): { readonly pairs: ReadonlyMap<string, ExpectedPair>; readonly duplicateKeys: ReadonlySet<string>; readonly issues: readonly AuditIssue[] } {
  const groups = new Map<string, ExpectedPair[]>()
  const issues: AuditIssue[] = []
  const locations = restaurantLocationIndex(data)
  for (const prefecture of data.prefectures) {
    const restaurants = data.restaurantsByPrefecture.get(prefecture) ?? []
    const matcher = new RestaurantMatcher([...restaurants], [...data.walkMinutesOverrides], [...data.exclusions])
    for (const hall of data.hallsByPrefecture.get(prefecture) ?? []) {
      const matches = matcher.matchForHall(hall)
      for (const match of matches) {
        const generatedId = resolver.resolveSourcePair(hall.id, match.restaurant.id)
        if (generatedId.generatedRestaurantId === null) {
          issues.push(createSourceGeneratedIdUnresolvableIssue(hall.id, match.restaurant.id, generatedId.reason ?? "source_generated_id_unresolvable", generatedId.location))
          continue
        }
        const pair = makeExpectedPair(data, hall, match.restaurant, match, prefecture, generatedId.generatedRestaurantId, locations)
        const key = generatedPairKey(hall.id, generatedId.generatedRestaurantId)
        const group = groups.get(key)
        if (group) group.push(pair)
        else groups.set(key, [pair])
      }
    }
  }
  const pairs = new Map<string, ExpectedPair>()
  const duplicateKeys = new Set<string>()
  for (const key of [...groups.keys()].sort(compareStrings)) {
    const candidates = [...(groups.get(key) ?? [])].sort(compareExpectedPairs)
    if (candidates.length > 1) {
      duplicateKeys.add(key)
      issues.push(createDuplicateExpectedPairIssue(key, candidates))
    } else if (candidates[0]) {
      pairs.set(key, candidates[0])
    }
  }
  return { pairs, duplicateKeys, issues }
}

type ActualPair = { readonly hall: PachinkoHall; readonly restaurant: GeneratedRestaurant; readonly resolution: GeneratedRestaurantResolution }

function collectActualPairs(data: AuditData, generatedHalls: readonly PachinkoHall[], resolver = createGeneratedRestaurantResolver(data)) {
  const pairs = new Map<string, ActualPair>()
  const issues: AuditIssue[] = []
  const groups = new Map<string, ActualPair[]>()
  for (const hall of generatedHalls) {
    for (const restaurant of hall.restaurants) {
      const key = generatedPairKey(hall.id, restaurant.id)
      const actual: ActualPair = { hall, restaurant, resolution: resolver.resolve(hall, restaurant) }
      const group = groups.get(key)
      if (group) group.push(actual)
      else groups.set(key, [actual])
    }
  }
  const duplicateKeys = new Set<string>()
  for (const key of [...groups.keys()].sort(compareStrings)) {
    const candidates = [...(groups.get(key) ?? [])].sort(compareActualPairs)
    if (candidates.length > 1) {
      duplicateKeys.add(key)
      issues.push(createDuplicateGeneratedPairIssue(key, candidates, data))
    } else if (candidates[0]) {
      pairs.set(key, candidates[0])
    }
  }
  return { pairs, duplicateKeys, issues }
}

function createDuplicateExpectedPairIssue(key: string, candidates: readonly ExpectedPair[]): AuditIssue {
  const representative = candidates[0]
  return createAuditIssue({
    code: "RESTAURANT_DISTANCE_ABNORMAL",
    severity: "error",
    entityType: "hall_restaurant_pair",
    entityId: `${representative.hall.id}|${representative.restaurant.id}`,
    file: representative.location.file,
    message: "期待される生成飲食店IDが同一ホール内で重複しています",
    details: {
      generatedPairKey: key,
      occurrenceCount: candidates.length,
      candidates: candidates.map(expectedCandidateSummary),
      reason: "duplicate_expected_pair_key",
      location: representative.location,
    },
    autoFixable: false,
  })
}

function createDuplicateGeneratedPairIssue(key: string, candidates: readonly ActualPair[], data: AuditData): AuditIssue {
  const representative = candidates[0]
  const resolution = representative.resolution
  const source = resolution.restaurant
  return createAuditIssue({
    code: "RESTAURANT_DISTANCE_ABNORMAL",
    severity: "error",
    entityType: "hall_restaurant_pair",
    entityId: source ? `${representative.hall.id}|${source.id}` : `${representative.hall.id}|generated-${representative.restaurant.id}`,
    file: resolution.location?.file ?? null,
    message: "生成物内でホールと飲食店IDの組み合わせが重複しています",
    details: {
      generatedPairKey: key,
      occurrenceCount: candidates.length,
      candidates: candidates.map(actualCandidateSummary),
      restaurantId: source?.id ?? null,
      generatedRestaurantId: representative.restaurant.id,
      sourceRestaurantId: source?.id ?? null,
      sourceResolution: candidates.map((candidate) => ({
        prefectureFile: candidate.resolution.prefectureFile,
        reason: candidate.resolution.reason,
        mismatchedFields: [...candidate.resolution.mismatchedFields],
      })),
      hasWalkOverride: source ? hasOverride(data, representative.hall.id, source.id) : false,
      isExcluded: source ? hasExclusion(data, representative.hall.id, source.id) : false,
      reason: "duplicate_generated_pair_key",
      location: resolution.location,
    },
    autoFixable: false,
  })
}

function createSourceGeneratedIdUnresolvableIssue(
  hallId: string,
  restaurantId: string,
  reason: string,
  location: EntityLocation | null,
): AuditIssue {
  return createAuditIssue({
    code: "RESTAURANT_DISTANCE_ABNORMAL",
    severity: "error",
    entityType: "hall_restaurant_pair",
    entityId: `${hallId}|${restaurantId}`,
    file: location?.file ?? null,
    message: "正本飲食店の生成数値IDを安全に解決できません",
    details: {
      hallId,
      restaurantId,
      generatedRestaurantId: null,
      sourceRestaurantId: restaurantId,
      reason,
      location,
    },
    autoFixable: false,
  })
}

function compareExpectedPairs(left: ExpectedPair, right: ExpectedPair): number {
  return compareStrings(left.restaurant.name, right.restaurant.name) ||
    compareStrings(left.restaurant.address, right.restaurant.address) ||
    left.restaurant.lat - right.restaurant.lat ||
    left.restaurant.lng - right.restaurant.lng ||
    compareStrings(left.restaurant.genre, right.restaurant.genre) ||
    left.match.walkMinutes - right.match.walkMinutes ||
    compareStrings(left.restaurant.id, right.restaurant.id)
}

function compareActualPairs(left: ActualPair, right: ActualPair): number {
  const leftRestaurant = left.restaurant
  const rightRestaurant = right.restaurant
  return compareStrings(leftRestaurant.name, rightRestaurant.name) ||
    compareStrings(leftRestaurant.address, rightRestaurant.address) ||
    leftRestaurant.lat - rightRestaurant.lat ||
    leftRestaurant.lng - rightRestaurant.lng ||
    compareStrings(leftRestaurant.genre, rightRestaurant.genre) ||
    leftRestaurant.walkMinutes - rightRestaurant.walkMinutes ||
    compareStrings(leftRestaurant.time_category.join("\u0000"), rightRestaurant.time_category.join("\u0000")) ||
    compareStrings(leftRestaurant.hours, rightRestaurant.hours) ||
    compareStrings(leftRestaurant.ai_summary, rightRestaurant.ai_summary) ||
    compareStrings(leftRestaurant.tags.join("\u0000"), rightRestaurant.tags.join("\u0000")) ||
    Number(leftRestaurant.is_kitaichimeshi ?? false) - Number(rightRestaurant.is_kitaichimeshi ?? false)
}

function expectedCandidateSummary(pair: ExpectedPair) {
  return {
    hallId: pair.hall.id,
    restaurantId: pair.restaurant.id,
    generatedRestaurantId: pair.generatedRestaurantId,
    name: pair.restaurant.name,
    address: pair.restaurant.address,
    lat: pair.restaurant.lat,
    lng: pair.restaurant.lng,
    genre: pair.restaurant.genre,
    walkMinutes: pair.match.walkMinutes,
  }
}

function actualCandidateSummary(pair: ActualPair) {
  const restaurant = pair.restaurant
  return {
    hallId: pair.hall.id,
    generatedRestaurantId: restaurant.id,
    name: restaurant.name,
    address: restaurant.address,
    lat: restaurant.lat,
    lng: restaurant.lng,
    genre: restaurant.genre,
    walkMinutes: restaurant.walkMinutes,
    timeCategory: [...restaurant.time_category],
    hours: restaurant.hours,
    aiSummary: restaurant.ai_summary,
    tags: [...restaurant.tags],
    isKitaichimeshi: restaurant.is_kitaichimeshi ?? false,
  }
}

function createPairIssue(
  code: "RESTAURANT_DISTANCE_ABNORMAL" | "RESTAURANT_WALK_OUTSIDE_SUSPECTED",
  severity: "error" | "warning",
  pair: ExpectedPair,
  actual: GeneratedRestaurant | null,
  reason: string,
): AuditIssue {
  return createAuditIssue({
    code,
    severity,
    entityType: "hall_restaurant_pair",
    entityId: `${pair.hall.id}|${pair.restaurant.id}`,
    file: pair.location.file,
    message: code === "RESTAURANT_DISTANCE_ABNORMAL" ? "生成物の飲食店掲載結果が再計算結果と一致しません" : "生成物の推定徒歩分数またはoverride反映が不正です",
    details: pairDetails(pair, actual, reason, actual !== null),
    autoFixable: false,
  })
}

function createActualOnlyIssue(
  code: "RESTAURANT_DISTANCE_ABNORMAL" | "RESTAURANT_WALK_OUTSIDE_SUSPECTED",
  actual: ActualPair,
  data: AuditData,
  reason: string,
): AuditIssue {
  const restaurant = actual.resolution.restaurant
  const hasWalkOverride = restaurant ? hasOverride(data, actual.hall.id, restaurant.id) : false
  const isExcluded = restaurant ? hasExclusion(data, actual.hall.id, restaurant.id) : false
  const straightDistanceMeters = restaurant ? stableMeters(haversineMeters(actual.hall, restaurant)) : null
  const estimatedWalkMinutes = restaurant ? estimateWalkMinutes(actual.hall, restaurant) : null
  return createAuditIssue({
    code,
    severity: "error",
    entityType: "hall_restaurant_pair",
    entityId: restaurant ? `${actual.hall.id}|${restaurant.id}` : `${actual.hall.id}|generated-${actual.restaurant.id}`,
    file: actual.resolution.location?.file ?? null,
    message: code === "RESTAURANT_DISTANCE_ABNORMAL" ? "生成物に再計算上の掲載対象外ペアが含まれています" : "生成物の推定徒歩分数が不正です",
    details: {
      hallId: actual.hall.id,
      restaurantId: restaurant?.id ?? null,
      generatedRestaurantId: actual.restaurant.id,
      sourceRestaurantId: restaurant?.id ?? null,
      straightDistanceMeters,
      estimatedWalkMinutes,
      effectiveWalkMinutes: actual.restaurant.walkMinutes,
      generatedWalkMinutes: actual.restaurant.walkMinutes,
      hasWalkOverride,
      isExcluded,
      expectedIncluded: false,
      actualIncluded: true,
      reason,
      location: actual.resolution.location,
    },
    autoFixable: false,
  })
}

function checkOverridesAndExclusions(
  data: AuditData,
  actual: ReadonlyMap<string, ActualPair>,
  resolver: ReturnType<typeof createGeneratedRestaurantResolver>,
): readonly AuditIssue[] {
  const issues: AuditIssue[] = []
  const references = [...new Set([...data.walkMinutesOverrides, ...data.exclusions].map((entry) => sourcePairKey(entry.hall_id, entry.restaurant_id)))].sort(compareStrings)
  for (const reference of references) {
    const separator = reference.indexOf("|")
    const hallId = reference.slice(0, separator)
    const restaurantId = reference.slice(separator + 1)
    const context = resolveSourcePair(data, hallId, restaurantId, resolver)
    if (!context) {
      const generatedId = resolver.resolveSourcePair(hallId, restaurantId)
      issues.push(createSourceGeneratedIdUnresolvableIssue(hallId, restaurantId, generatedId.reason ?? "source_generated_id_unresolvable", generatedId.location))
      continue
    }
    const generated = actual.get(generatedPairKey(hallId, context.generatedRestaurantId))
    if (context.isExcluded) {
      if (generated) issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "error", context, generated.restaurant, "excluded_pair_generated"))
      continue
    }
    if (!context.hasWalkOverride) continue
    if (!context.finalIncluded) {
      issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "error", context, generated?.restaurant ?? null, "override_not_effective"))
    } else if (!generated) {
      issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "error", context, null, "override_missing_generated"))
    } else if (generated.restaurant.walkMinutes !== context.match.walkMinutes) {
      issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "error", context, generated.restaurant, "override_walk_minutes_mismatch"))
    }
    if (context.finalIncluded && !context.baseIncluded) {
      issues.push(createPairIssue("RESTAURANT_WALK_OUTSIDE_SUSPECTED", "warning", context, generated?.restaurant ?? null, "included_only_by_walk_override"))
    }
  }
  return issues
}

function resolveSourcePair(
  data: AuditData,
  hallId: string,
  restaurantId: string,
  resolver: ReturnType<typeof createGeneratedRestaurantResolver>,
): ExpectedPair | null {
  const hallEntry = getHallLocations(data).find(({ entity }) => entity.id === hallId)
  if (!hallEntry || !hallEntry.location.prefecture) return null
  const hall = hallEntry.entity
  const prefecture = hallEntry.location.prefecture
  const restaurants = data.restaurantsByPrefecture.get(prefecture) ?? []
  const restaurant = restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) return null
  const finalMatch = new RestaurantMatcher([...restaurants], [...data.walkMinutesOverrides], [...data.exclusions]).matchForHall(hall).find((item) => item.restaurant.id === restaurantId) ?? null
  const baseIncluded = new RestaurantMatcher([...restaurants], [], []).matchForHall(hall).some((item) => item.restaurant.id === restaurantId)
  const fallbackMatch: MatchedRestaurant = { restaurant, walkMinutes: estimateWalkMinutes(hall, restaurant), isOverride: hasOverride(data, hallId, restaurantId) }
  const generatedId = resolver.resolveSourcePair(hallId, restaurantId)
  if (generatedId.generatedRestaurantId === null) return null
  return makeExpectedPair(data, hall, restaurant, finalMatch ?? fallbackMatch, prefecture, generatedId.generatedRestaurantId, restaurantLocationIndex(data), finalMatch, baseIncluded)
}

function pairDetails(
  pair: ExpectedPair,
  actual: GeneratedRestaurant | null,
  reason: string,
  actualIncluded: boolean,
) {
  const straightDistanceMeters = stableMeters(haversineMeters(pair.hall, pair.restaurant))
  const estimatedWalkMinutes = estimateWalkMinutes(pair.hall, pair.restaurant)
  return {
    hallId: pair.hall.id,
    restaurantId: pair.restaurant.id,
    straightDistanceMeters,
    estimatedWalkMinutes,
    effectiveWalkMinutes: pair.match.walkMinutes,
    generatedWalkMinutes: actual?.walkMinutes ?? null,
    hasWalkOverride: pair.hasWalkOverride,
    isExcluded: pair.isExcluded,
    expectedIncluded: pair.finalIncluded && !pair.isExcluded,
    actualIncluded,
    reason,
    location: pair.location,
  }
}

function makeExpectedPair(data: AuditData, hall: HallInput, restaurant: RestaurantInput, match: MatchedRestaurant, prefectureFile: string, generatedRestaurantId: number, locations: ReadonlyMap<string, EntityLocation>, finalMatch: MatchedRestaurant | null = match, baseIncluded = true): ExpectedPair {
  const location = locations.get(`${prefectureFile}|${restaurant.id}`) ?? { entityId: restaurant.id, file: `data/prefectures/${prefectureFile}/restaurants.json`, prefecture: prefectureFile, index: -1 }
  return { key: sourcePairKey(hall.id, restaurant.id), prefectureFile, hall, restaurant, generatedRestaurantId, match: finalMatch ?? match, location, hasWalkOverride: hasOverride(data, hall.id, restaurant.id), isExcluded: hasExclusion(data, hall.id, restaurant.id), baseIncluded, finalIncluded: finalMatch !== null }
}

function restaurantLocationIndex(data: AuditData): ReadonlyMap<string, EntityLocation> {
  return new Map(getRestaurantLocations(data).map(({ entity, location }) => [`${location.prefecture}|${entity.id}`, location]))
}

function hasOverride(data: AuditData, hallId: string, restaurantId: string): boolean { return data.walkMinutesOverrides.some((entry) => entry.hall_id === hallId && entry.restaurant_id === restaurantId) }
function hasExclusion(data: AuditData, hallId: string, restaurantId: string): boolean { return data.exclusions.some((entry) => entry.hall_id === hallId && entry.restaurant_id === restaurantId) }
function isValidWalkMinutes(value: number): boolean { return WalkMinutesOverrideSchema.shape.walkMinutes.safeParse(value).success }
function createResolutionIssue(data: AuditData, actual: ActualPair, resolution: GeneratedRestaurantResolution): AuditIssue {
  const source = resolution.restaurant
  return createAuditIssue({
    code: "RESTAURANT_DISTANCE_ABNORMAL", severity: "error", entityType: "hall_restaurant_pair",
    entityId: source ? `${actual.hall.id}|${source.id}` : `${actual.hall.id}|generated-${actual.restaurant.id}`, file: resolution.location?.file ?? null,
    message: "生成物の飲食店を正本店舗へ一意に解決できません",
    details: {
      hallId: actual.hall.id,
      restaurantId: source?.id ?? null,
      generatedRestaurantId: actual.restaurant.id,
      sourceRestaurantId: source?.id ?? null,
      prefectureFile: resolution.prefectureFile,
      mismatchedFields: resolution.mismatchedFields,
      generatedName: actual.restaurant.name,
      sourceName: source?.name ?? null,
      straightDistanceMeters: source ? stableMeters(haversineMeters(actual.hall, source)) : null,
      estimatedWalkMinutes: source ? estimateWalkMinutes(actual.hall, source) : null,
      effectiveWalkMinutes: actual.restaurant.walkMinutes,
      generatedWalkMinutes: actual.restaurant.walkMinutes,
      hasWalkOverride: source ? hasOverride(data, actual.hall.id, source.id) : false,
      isExcluded: source ? hasExclusion(data, actual.hall.id, source.id) : false,
      expectedIncluded: false,
      actualIncluded: true,
      reason: resolution.reason ?? "generated_restaurant_source_unresolved",
      location: resolution.location,
    }, autoFixable: false,
  })
}

function resolvePrefectureLabel(data: AuditData, prefectureFile: string | null): string | null {
  if (!prefectureFile) return null
  const labels = new Set((data.hallsByPrefecture.get(prefectureFile) ?? []).map((hall) => hall.prefecture))
  return labels.size === 1 ? [...labels][0] : null
}

function generatedPairKey(hallId: string, restaurantId: number): string {
  return `${hallId}|${restaurantId}`
}

function sourcePairKey(hallId: string, restaurantId: string): string {
  return `${hallId}|${restaurantId}`
}

function coordinateKey(lat: number, lng: number, precision: number): string {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`
}

function isInsideBoundingBox(lat: number, lng: number, boundingBox: PrefectureBoundingBox): boolean {
  return lat >= boundingBox.minLat && lat <= boundingBox.maxLat && lng >= boundingBox.minLng && lng <= boundingBox.maxLng
}

function stableMeters(value: number): number {
  return Number(value.toFixed(3))
}

function coordinateDetailValue(value: unknown): string | number | boolean | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (value === undefined) return null
  return Object.prototype.toString.call(value)
}
