import { RestaurantSchema, type AiSummaryOverride, type RestaurantInput } from "../lib/schema"
import { createAuditIssue } from "./report"
import {
  compareStrings,
  getRestaurantLocations,
  groupBy,
  isBlank,
  sortLocations,
  sortedUnique,
  type EntityLocation,
  type LocatedEntity,
} from "./rule-utils"
import {
  RESTAURANT_ADDRESS_PLACEHOLDERS,
  RESTAURANT_ADDRESS_WARNING_MIN_LENGTH,
  RESTAURANT_FABRICATION_SIGNALS,
  RESTAURANT_SUMMARY_EXACT_MIN_LENGTH,
  RESTAURANT_SUMMARY_FABRICATION_SIGNALS,
  RESTAURANT_SUMMARY_SIMILARITY_MIN_LENGTH,
  RESTAURANT_SUMMARY_SIMILARITY_THRESHOLD,
} from "./restaurant-quality-config"
import {
  bigramJaccardSimilarity,
  normalizeComparableName,
  normalizeComparableText,
} from "./text-similarity"
import type { AuditData, AuditIssue } from "./types"

export const RESTAURANT_RULE_CODES = [
  "RESTAURANT_NAME_DUPLICATE",
  "RESTAURANT_GENRE_INVALID",
  "RESTAURANT_ADDRESS_MISSING",
  "RESTAURANT_SUMMARY_EXACT_DUPLICATE",
  "RESTAURANT_SUMMARY_SIMILAR",
  "RESTAURANT_FABRICATION_SUSPECTED",
] as const

export const RESTAURANT_RULE_COUNT = RESTAURANT_RULE_CODES.length

type RestaurantEntry = LocatedEntity<RestaurantInput>
type SummarySource = "default" | "override"

type SummaryEntry = {
  readonly source: SummarySource
  readonly summary: string
  readonly restaurantId: string
  readonly hallId: string | null
  readonly location: EntityLocation
}

const EXPLICIT_NAME_PLACEHOLDERS = new Set([
  "仮称",
  "未定",
  "テスト",
  "サンプル",
  "sample",
  "test",
  "dummy",
  "unknown",
  "tbd",
])

/** S1-04 は飲食店の内容品質だけを検査し、S1-02のID・参照監査は重複しない。 */
export function checkRestaurants(data: AuditData): readonly AuditIssue[] {
  const restaurants = getRestaurantLocations(data)
  const summaries = getSummaryEntries(data, restaurants)
  return [
    ...checkDuplicateNames(restaurants),
    ...checkGenres(restaurants),
    ...checkAddresses(restaurants),
    ...checkExactSummaryDuplicates(summaries),
    ...checkSimilarSummaries(summaries),
    ...checkFabricationSignals(restaurants),
    ...checkOverrideFabricationSignals(data.aiSummaryOverrides),
  ]
}

function checkDuplicateNames(entries: readonly RestaurantEntry[]): readonly AuditIssue[] {
  return [...groupBy(entries, ({ entity, location }) =>
    `${location.prefecture ?? ""}\u0000${normalizeComparableName(entity.name)}`,
  ).entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      const hasSameAddress = hasDuplicateValue(group, ({ entity }) => normalizeComparableText(entity.address))
      const hasSameCoordinates = hasDuplicateValue(group, ({ entity }) => coordinateKey(entity))
      const matchBasis = matchBasisForNameDuplicate(hasSameAddress, hasSameCoordinates)
      return createAuditIssue({
        code: "RESTAURANT_NAME_DUPLICATE",
        severity: matchBasis ? "error" : "warning",
        entityType: "restaurant",
        entityId: null,
        file: locations[0]?.file ?? null,
        message: matchBasis
          ? "同一都道府県ファイル内で同名の飲食店が重複登録されている可能性があります"
          : "同一都道府県ファイル内で正規化後の飲食店名が重複しています",
        details: {
          normalizedName: normalizeComparableName(group[0]?.entity.name ?? ""),
          matchBasis: matchBasis ?? "name_only",
          occurrenceCount: locations.length,
          restaurantIds: locations.map((location) => location.entityId ?? ""),
          addresses: sortedUnique(group.map(({ entity }) => normalizeComparableText(entity.address))),
          locations,
        },
        autoFixable: false,
      })
    })
}

function checkGenres(entries: readonly RestaurantEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: restaurant, location }) => {
    if (RestaurantSchema.shape.genre.safeParse(restaurant.genre).success) return []
    return [
      createAuditIssue({
        code: "RESTAURANT_GENRE_INVALID",
        severity: "error",
        entityType: "restaurant",
        entityId: restaurant.id,
        file: location.file,
        message: "飲食店カテゴリが許可されたカテゴリに含まれていません",
        details: { genre: restaurant.genre, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkAddresses(entries: readonly RestaurantEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: restaurant, location }) => {
    if (isBlank(restaurant.address)) return []
    const address = normalizeComparableText(restaurant.address)
    const errorReason = getAddressErrorReason(address)
    if (errorReason) {
      return [
        createAuditIssue({
          code: "RESTAURANT_ADDRESS_MISSING",
          severity: "error",
          entityType: "restaurant",
          entityId: restaurant.id,
          file: location.file,
          message: "飲食店住所が住所として成立しない内容です",
          details: { address: restaurant.address, reason: errorReason, location },
          autoFixable: false,
        }),
      ]
    }
    const warningReasons = getAddressWarningReasons(address)
    if (warningReasons.length === 0) return []
    return [
      createAuditIssue({
        code: "RESTAURANT_ADDRESS_MISSING",
        severity: "warning",
        entityType: "restaurant",
        entityId: restaurant.id,
        file: location.file,
        message: "飲食店住所の粒度が不足している可能性があります",
        details: { address: restaurant.address, reasons: warningReasons, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkExactSummaryDuplicates(entries: readonly SummaryEntry[]): readonly AuditIssue[] {
  return (['default', 'override'] as const).flatMap((source) =>
    [...groupBy(
      entries.filter((entry) => entry.source === source && normalizeComparableText(entry.summary).length >= RESTAURANT_SUMMARY_EXACT_MIN_LENGTH),
      (entry) => normalizeComparableText(entry.summary),
    ).entries()]
      .filter(([, group]) => group.length > 1)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([summary, group]) => createSummaryDuplicateIssue(source, summary, group)),
  )
}

function checkSimilarSummaries(entries: readonly SummaryEntry[]): readonly AuditIssue[] {
  const issues: AuditIssue[] = []
  for (const source of ['default', 'override'] as const) {
    const candidates = entries.filter(
      (entry) =>
        entry.source === source &&
        normalizeComparableText(entry.summary).length >= RESTAURANT_SUMMARY_SIMILARITY_MIN_LENGTH,
    )
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) {
        const leftEntry = candidates[left]
        const rightEntry = candidates[right]
        const leftSummary = normalizeComparableText(leftEntry.summary)
        const rightSummary = normalizeComparableText(rightEntry.summary)
        if (leftSummary === rightSummary) continue
        const similarity = bigramJaccardSimilarity(leftSummary, rightSummary)
        if (similarity < RESTAURANT_SUMMARY_SIMILARITY_THRESHOLD) continue
        const locations = sortLocations([leftEntry.location, rightEntry.location])
        issues.push(
          createAuditIssue({
            code: "RESTAURANT_SUMMARY_SIMILAR",
            severity: "warning",
            entityType: source === "default" ? "restaurant" : "ai_summary_override",
            entityId: null,
            file: locations[0]?.file ?? null,
            message: "同じ種類の飲食店紹介文が非常に類似しています",
            details: summaryPairDetails(source, locations, leftEntry, rightEntry, {
              similarity: Number(similarity.toFixed(6)),
              threshold: RESTAURANT_SUMMARY_SIMILARITY_THRESHOLD,
            }),
            autoFixable: false,
          }),
        )
      }
    }
  }
  return issues
}

function checkFabricationSignals(entries: readonly RestaurantEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: restaurant, location }) => {
    const signals = [
      ...getNameSignals(restaurant.name),
      ...getInternalSignals("selection_note", restaurant.selection_note),
      ...(restaurant.selection_tags ?? []).flatMap((tag) => getInternalSignals("selection_tags", tag)),
      ...getSummarySignals(restaurant.default_ai_summary),
    ].sort(compareStrings)
    if (signals.length === 0) return []
    const matchedTags = (restaurant.selection_tags ?? []).filter((tag) =>
      getInternalSignals("selection_tags", tag).length > 0,
    )
    const hasSelectionNoteSignal = getInternalSignals("selection_note", restaurant.selection_note).length > 0
    return [
      createAuditIssue({
        code: "RESTAURANT_FABRICATION_SUSPECTED",
        severity: "warning",
        entityType: "restaurant",
        entityId: restaurant.id,
        file: location.file,
        message: "飲食店データにseed・推測・仮データを示す強い兆候があります",
        details: {
          signals: sortedUnique(signals),
          location,
          name: restaurant.name,
          source: "restaurant",
          selectionTags: sortedUnique(matchedTags),
          selectionNote: hasSelectionNoteSignal ? "matched_signal" : null,
        },
        autoFixable: false,
      }),
    ]
  })
}

function checkOverrideFabricationSignals(
  overrides: readonly AiSummaryOverride[],
): readonly AuditIssue[] {
  return overrides.flatMap((override, index) => {
    const signals = sortedUnique(getSummarySignals(override.ai_summary, "ai_summary"))
    if (signals.length === 0) return []
    const location = overrideLocation(override, index)
    return [
      createAuditIssue({
        code: "RESTAURANT_FABRICATION_SUSPECTED",
        severity: "warning",
        entityType: "ai_summary_override",
        entityId: location.entityId,
        file: location.file,
        message: "override紹介文に生成途中または仮データを示す強い兆候があります",
        details: {
          signals,
          hallId: override.hall_id,
          restaurantId: override.restaurant_id,
          location,
          source: "override",
        },
        autoFixable: false,
      }),
    ]
  })
}

function getSummaryEntries(
  data: AuditData,
  restaurants: readonly RestaurantEntry[],
): readonly SummaryEntry[] {
  const defaultEntries = restaurants.map(({ entity, location }) => ({
    source: "default" as const,
    summary: entity.default_ai_summary,
    restaurantId: entity.id,
    hallId: null,
    location,
  }))
  const overrideEntries = data.aiSummaryOverrides.map((override, index) => ({
    source: "override" as const,
    summary: override.ai_summary,
    restaurantId: override.restaurant_id,
    hallId: override.hall_id,
    location: overrideLocation(override, index),
  }))
  return [...defaultEntries, ...overrideEntries]
}

function createSummaryDuplicateIssue(
  source: SummarySource,
  summary: string,
  group: readonly SummaryEntry[],
): AuditIssue {
  const locations = sortLocations(group.map((entry) => entry.location))
  return createAuditIssue({
    code: "RESTAURANT_SUMMARY_EXACT_DUPLICATE",
    severity: group.length >= 3 ? "error" : "warning",
    entityType: source === "default" ? "restaurant" : "ai_summary_override",
    entityId: null,
    file: locations[0]?.file ?? null,
    message: "同じ種類の飲食店紹介文が完全に重複しています",
    details: summaryGroupDetails(source, summary, locations, group),
    autoFixable: false,
  })
}

function summaryGroupDetails(
  source: SummarySource,
  summary: string,
  locations: readonly EntityLocation[],
  group: readonly SummaryEntry[],
) {
  const common = {
    source,
    normalizedLength: summary.length,
    occurrenceCount: locations.length,
    restaurantIds: sortedUnique(group.map((entry) => entry.restaurantId)),
    locations,
  }
  return source === "override"
    ? { ...common, hallIds: sortedUnique(group.map((entry) => entry.hallId ?? "")) }
    : common
}

function summaryPairDetails(
  source: SummarySource,
  locations: readonly EntityLocation[],
  left: SummaryEntry,
  right: SummaryEntry,
  similarity: { readonly similarity: number; readonly threshold: number },
) {
  const common = {
    source,
    ...similarity,
    restaurantIds: sortedUnique([left.restaurantId, right.restaurantId]),
    locations,
  }
  return source === "override"
    ? { ...common, hallIds: sortedUnique([left.hallId ?? "", right.hallId ?? ""]) }
    : common
}

function overrideLocation(override: AiSummaryOverride, index: number): EntityLocation {
  return {
    entityId: `${override.hall_id}|${override.restaurant_id}`,
    file: "data/overrides/ai-summary.json",
    prefecture: null,
    index,
  }
}

function hasDuplicateValue<T>(
  values: readonly T[],
  valueOf: (value: T) => string | null,
): boolean {
  const seen = new Set<string>()
  for (const value of values) {
    const key = valueOf(value)
    if (key === null) continue
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

function coordinateKey(restaurant: RestaurantInput): string | null {
  const lat = restaurant.lat as unknown
  const lng = restaurant.lng as unknown
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  return `${lat},${lng}`
}

function matchBasisForNameDuplicate(
  hasSameAddress: boolean,
  hasSameCoordinates: boolean,
): string | null {
  if (hasSameAddress && hasSameCoordinates) return "name_and_address_and_coordinates"
  if (hasSameAddress) return "name_and_address"
  if (hasSameCoordinates) return "name_and_coordinates"
  return null
}

function getAddressErrorReason(value: string): string | null {
  const lower = value.toLocaleLowerCase("en-US")
  if (RESTAURANT_ADDRESS_PLACEHOLDERS.some((placeholder) => lower === placeholder)) {
    return "explicit_placeholder"
  }
  if (/^https?:\/\//iu.test(value)) return "url_only"
  if (/^[+-]?\d+(?:\.\d+)?\s*[,，]\s*[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return "coordinate_only"
  }
  return null
}

function getAddressWarningReasons(value: string): readonly string[] {
  const reasons: string[] = []
  if (value.length < RESTAURANT_ADDRESS_WARNING_MIN_LENGTH) reasons.push("too_short")
  if (!/\d/u.test(value)) reasons.push("lot_number_missing")
  if (/^(?:[^都道府県市区町村郡]+(?:ビル|マンション|タワー|施設))$/u.test(value)) {
    reasons.push("building_only")
  }
  if (!/[都道府県]/u.test(value) && !/[市区町村郡]/u.test(value) && value.length < 16) {
    reasons.push("region_information_sparse")
  }
  return reasons.sort(compareStrings)
}

function getNameSignals(value: string): readonly string[] {
  const normalized = normalizeComparableName(value)
  if (EXPLICIT_NAME_PLACEHOLDERS.has(normalized)) return ["name:explicit_placeholder"]
  if (/^(?:店舗|飲食店)\s*\d{1,3}$/u.test(normalized)) return ["name:generic_serial"]
  if (/^restaurant[- ]?\d{1,3}$/iu.test(normalized)) return ["name:generic_serial"]
  return []
}

function getInternalSignals(scope: string, value: string | undefined): readonly string[] {
  if (!value) return []
  const normalized = normalizeComparableText(value).toLocaleLowerCase("en-US")
  return RESTAURANT_FABRICATION_SIGNALS.filter((signal) => containsStrongSignal(normalized, signal)).map(
    (signal) => `${scope}:${signal}`,
  )
}

function getSummarySignals(
  value: string,
  scope = "default_ai_summary",
): readonly string[] {
  const normalized = normalizeComparableText(value).toLocaleLowerCase("en-US")
  return RESTAURANT_SUMMARY_FABRICATION_SIGNALS.filter((signal) =>
    containsStrongSignal(normalized, signal),
  ).map((signal) => `${scope}:${signal}`)
}

function containsStrongSignal(value: string, signal: string): boolean {
  if (/^[a-z]+$/u.test(signal)) {
    return new RegExp(`(?:^|[^a-z])${signal}(?:$|[^a-z])`, "u").test(value)
  }
  return value.includes(signal)
}
