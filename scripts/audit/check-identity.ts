import {
  AreaSchema,
  ChainSchema,
  HallSchema,
  RestaurantSchema,
} from "../lib/schema"
import { createAuditIssue } from "./report"
import {
  compareStrings,
  getAreaLocations,
  getChainLocations,
  getHallLocations,
  getRestaurantLocations,
  groupBy,
  isBlank,
  sortLocations,
  sortedUnique,
  type LocatedEntity,
} from "./rule-utils"
import type { AuditData, AuditIssue } from "./types"

/** S1-02で実行するID・必須項目ルール。後続CLIは件数をcheckedRulesへ渡せる。 */
export const IDENTITY_RULE_CODES = [
  "AREA_ID_DUPLICATE",
  "AREA_ID_FORMAT",
  "AREA_REQUIRED_MISSING",
  "CHAIN_ID_DUPLICATE",
  "CHAIN_ID_FORMAT",
  "CHAIN_REQUIRED_MISSING",
  "HALL_ID_DUPLICATE",
  "HALL_ID_FORMAT",
  "HALL_REQUIRED_MISSING",
  "RESTAURANT_ID_DUPLICATE",
  "RESTAURANT_ID_FORMAT",
  "RESTAURANT_LEGACY_ID_DUPLICATE",
  "RESTAURANT_REQUIRED_MISSING",
] as const

export const IDENTITY_RULE_COUNT = IDENTITY_RULE_CODES.length

/** 元データを変更せず、ID・必須項目・legacy_idの決定論的な異常を返す。 */
export function checkIdentity(data: AuditData): readonly AuditIssue[] {
  const areas = getAreaLocations(data)
  const chains = getChainLocations(data)
  const halls = getHallLocations(data)
  const restaurants = getRestaurantLocations(data)

  return [
    ...checkDuplicateIds("AREA_ID_DUPLICATE", "area", areas),
    ...checkIdFormat("AREA_ID_FORMAT", "area", areas, AreaSchema.shape.id),
    ...checkRequiredFields("AREA_REQUIRED_MISSING", "area", areas, [
      "id",
      "name",
      "prefecture",
      "area_description",
    ]),
    ...checkDuplicateIds("CHAIN_ID_DUPLICATE", "chain", chains),
    ...checkIdFormat("CHAIN_ID_FORMAT", "chain", chains, ChainSchema.shape.id),
    ...checkRequiredFields("CHAIN_REQUIRED_MISSING", "chain", chains, [
      "id",
      "name",
      "description",
    ]),
    ...checkDuplicateIds("HALL_ID_DUPLICATE", "hall", halls),
    ...checkIdFormat("HALL_ID_FORMAT", "hall", halls, HallSchema.shape.id),
    ...checkRequiredFields("HALL_REQUIRED_MISSING", "hall", halls, [
      "id",
      "name",
      "area_id",
      "prefecture",
      "city",
      "address",
      "access",
      "hours",
      "pachiya_comment",
      "meal_guide",
    ]),
    ...checkDuplicateIds("RESTAURANT_ID_DUPLICATE", "restaurant", restaurants),
    ...checkIdFormat(
      "RESTAURANT_ID_FORMAT",
      "restaurant",
      restaurants,
      RestaurantSchema.shape.id,
    ),
    ...checkRestaurantLegacyIds(restaurants),
    ...checkRestaurantRequiredFields(restaurants),
  ]
}

function checkDuplicateIds<T extends { id: string }>(
  code: string,
  entityType: string,
  entries: readonly LocatedEntity<T>[],
): readonly AuditIssue[] {
  const groups = groupBy(entries, ({ entity }) => entity.id)
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([id, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code,
        severity: "error",
        entityType,
        entityId: id,
        file: locations[0]?.file ?? null,
        message: `${entityType} ID が重複しています`,
        details: {
          duplicateId: id,
          occurrenceCount: locations.length,
          locations,
        },
        autoFixable: false,
      })
    })
}

function checkIdFormat<T extends { id: string }>(
  code: string,
  entityType: string,
  entries: readonly LocatedEntity<T>[],
  idSchema: { safeParse(value: unknown): { success: boolean } },
): readonly AuditIssue[] {
  return entries
    .filter(({ entity }) => !idSchema.safeParse(entity.id).success)
    .map(({ entity, location }) =>
      createAuditIssue({
        code,
        severity: "error",
        entityType,
        entityId: entity.id || null,
        file: location.file,
        message: `${entityType} ID がslug命名規則に適合しません`,
        details: { id: entity.id, location },
        autoFixable: false,
      }),
    )
}

function checkRequiredFields<T extends Record<string, unknown>>(
  code: string,
  entityType: string,
  entries: readonly LocatedEntity<T>[],
  fields: readonly string[],
): readonly AuditIssue[] {
  return entries.flatMap(({ entity, location }) => {
    const missingFields = fields.filter((field) => isBlank(entity[field])).sort(compareStrings)
    if (missingFields.length === 0) return []
    return [
      createAuditIssue({
        code,
        severity: "error",
        entityType,
        entityId: typeof entity.id === "string" && entity.id ? entity.id : null,
        file: location.file,
        message: `${entityType} の必須項目に空白があります`,
        details: { missingFields, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkRestaurantRequiredFields(
  entries: readonly LocatedEntity<AuditData["restaurants"][number]>[],
): readonly AuditIssue[] {
  const textIssues = checkRequiredFields("RESTAURANT_REQUIRED_MISSING", "restaurant", entries, [
    "id",
    "name",
    "genre",
    "hours",
    "address",
    "default_ai_summary",
  ])
  const timeCategoryIssues = entries.flatMap(({ entity, location }) => {
    if (Array.isArray(entity.time_category) && entity.time_category.length > 0) return []
    return [
      createAuditIssue({
        code: "RESTAURANT_REQUIRED_MISSING",
        severity: "error",
        entityType: "restaurant",
        entityId: entity.id || null,
        file: location.file,
        message: "restaurant の必須項目に空白があります",
        details: { missingFields: ["time_category"], location },
        autoFixable: false,
      }),
    ]
  })
  return [...textIssues, ...timeCategoryIssues]
}

function checkRestaurantLegacyIds(
  entries: readonly LocatedEntity<AuditData["restaurants"][number]>[],
): readonly AuditIssue[] {
  const withLegacyId = entries.filter(({ entity }) => entity.legacy_id !== undefined)
  const groups = groupBy(withLegacyId, ({ entity }) => String(entity.legacy_id))

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([legacyId, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      const prefectures = sortedUnique(
        locations
          .map((location) => location.prefecture)
          .filter((prefecture): prefecture is string => prefecture !== null),
      )
      const hasSamePrefectureDuplicate = prefectures.some(
        (prefecture) => locations.filter((location) => location.prefecture === prefecture).length > 1,
      )
      return createAuditIssue({
        code: "RESTAURANT_LEGACY_ID_DUPLICATE",
        severity: hasSamePrefectureDuplicate ? "error" : "warning",
        entityType: "restaurant",
        entityId: legacyId,
        file: locations[0]?.file ?? null,
        message: "restaurant legacy_id が重複しています",
        details: {
          legacyId: Number(legacyId),
          occurrenceCount: locations.length,
          prefectures,
          restaurantIds: locations.map((location) => location.entityId ?? ""),
          locations,
        },
        autoFixable: false,
      })
    })
}
