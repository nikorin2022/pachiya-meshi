import type {
  AiSummaryOverride,
  ExclusionOverride,
  WalkMinutesOverride,
} from "../lib/schema"
import { createAuditIssue } from "./report"
import {
  compareStrings,
  getHallLocations,
  getRestaurantLocations,
  groupBy,
  sortLocations,
  type EntityLocation,
} from "./rule-utils"
import type { AuditData, AuditIssue } from "./types"

/** S1-02で実行する参照整合性ルール。 */
export const REFERENCE_RULE_CODES = [
  "HALL_AREA_REF_INVALID",
  "HALL_CHAIN_REF_INVALID",
  "RESTAURANT_AREA_REF_INVALID",
  "WALK_OVERRIDE_HALL_REF_INVALID",
  "WALK_OVERRIDE_RESTAURANT_REF_INVALID",
  "WALK_OVERRIDE_PAIR_DUPLICATE",
  "AI_SUMMARY_OVERRIDE_HALL_REF_INVALID",
  "AI_SUMMARY_OVERRIDE_RESTAURANT_REF_INVALID",
  "AI_SUMMARY_OVERRIDE_PAIR_DUPLICATE",
  "EXCLUSION_HALL_REF_INVALID",
  "EXCLUSION_RESTAURANT_REF_INVALID",
  "EXCLUSION_PAIR_DUPLICATE",
] as const

export const REFERENCE_RULE_COUNT = REFERENCE_RULE_CODES.length

/** 元データを変更せず、masterとoverride/exclusionの参照整合性を返す。 */
export function checkReferences(data: AuditData): readonly AuditIssue[] {
  return [
    ...checkHallReferences(data),
    ...checkRestaurantAreaReferences(data),
    ...checkPairReferences(data, {
      entries: data.walkMinutesOverrides,
      file: "data/overrides/walk-minutes.json",
      entityType: "walk_override",
      hallCode: "WALK_OVERRIDE_HALL_REF_INVALID",
      restaurantCode: "WALK_OVERRIDE_RESTAURANT_REF_INVALID",
      duplicateCode: "WALK_OVERRIDE_PAIR_DUPLICATE",
    }),
    ...checkPairReferences(data, {
      entries: data.aiSummaryOverrides,
      file: "data/overrides/ai-summary.json",
      entityType: "ai_summary_override",
      hallCode: "AI_SUMMARY_OVERRIDE_HALL_REF_INVALID",
      restaurantCode: "AI_SUMMARY_OVERRIDE_RESTAURANT_REF_INVALID",
      duplicateCode: "AI_SUMMARY_OVERRIDE_PAIR_DUPLICATE",
    }),
    ...checkPairReferences(data, {
      entries: data.exclusions,
      file: "data/overrides/exclusions.json",
      entityType: "exclusion",
      hallCode: "EXCLUSION_HALL_REF_INVALID",
      restaurantCode: "EXCLUSION_RESTAURANT_REF_INVALID",
      duplicateCode: "EXCLUSION_PAIR_DUPLICATE",
    }),
  ]
}

function checkHallReferences(data: AuditData): readonly AuditIssue[] {
  return getHallLocations(data).flatMap(({ entity: hall, location }) => {
    const issues: AuditIssue[] = []
    const area = data.indexes.areaById.get(hall.area_id)
    if (!area) {
      issues.push(
        createAuditIssue({
          code: "HALL_AREA_REF_INVALID",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "hall の area_id 参照先がありません",
          details: { areaId: hall.area_id, reason: "area_not_found", location },
          autoFixable: false,
        }),
      )
    } else if (area.prefecture !== hall.prefecture) {
      issues.push(
        createAuditIssue({
          code: "HALL_AREA_REF_INVALID",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "hall と area の都道府県が一致しません",
          details: {
            areaId: hall.area_id,
            areaPrefecture: area.prefecture,
            hallPrefecture: hall.prefecture,
            reason: "prefecture_mismatch",
            location,
          },
          autoFixable: false,
        }),
      )
    }

    if (hall.chain_id && !data.indexes.chainById.has(hall.chain_id)) {
      issues.push(
        createAuditIssue({
          code: "HALL_CHAIN_REF_INVALID",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "hall の chain_id 参照先がありません",
          details: { chainId: hall.chain_id, location },
          autoFixable: false,
        }),
      )
    }
    return issues
  })
}

function checkRestaurantAreaReferences(data: AuditData): readonly AuditIssue[] {
  return getRestaurantLocations(data).flatMap(({ entity: restaurant, location }) => {
    if (!restaurant.area_id) return []
    const area = data.indexes.areaById.get(restaurant.area_id)
    if (!area) {
      return [
        createAuditIssue({
          code: "RESTAURANT_AREA_REF_INVALID",
          severity: "error",
          entityType: "restaurant",
          entityId: restaurant.id,
          file: location.file,
          message: "restaurant の area_id 参照先がありません",
          details: { areaId: restaurant.area_id, reason: "area_not_found", location },
          autoFixable: false,
        }),
      ]
    }
    const filePrefecture = getPrefectureLabelForFile(data, location.prefecture)
    if (filePrefecture.status === "unresolved") {
      return [
        createAuditIssue({
          code: "RESTAURANT_AREA_REF_INVALID",
          severity: "error",
          entityType: "restaurant",
          entityId: restaurant.id,
          file: location.file,
          message: "restaurant の所属都道府県を一意に判定できません",
          details: {
            areaId: restaurant.area_id,
            areaPrefecture: area.prefecture,
            restaurantPrefectureFile: location.prefecture,
            reason: "prefecture_label_unresolved",
            location,
          },
          autoFixable: false,
        }),
      ]
    }
    if (area.prefecture !== filePrefecture.label) {
      return [
        createAuditIssue({
          code: "RESTAURANT_AREA_REF_INVALID",
          severity: "error",
          entityType: "restaurant",
          entityId: restaurant.id,
          file: location.file,
          message: "restaurant の所属都道府県と area が一致しません",
          details: {
            areaId: restaurant.area_id,
            areaPrefecture: area.prefecture,
            restaurantPrefecture: filePrefecture.label,
            restaurantPrefectureFile: location.prefecture,
            reason: "prefecture_mismatch",
            location,
          },
          autoFixable: false,
        }),
      ]
    }
    return []
  })
}

/**
 * RestaurantInput 自体には都道府県表示名がないため、同じ都道府県ファイルの
 * hall.prefecture を既存データの正本として使う。判定不能は参照整合性errorとして扱う。
 */
function getPrefectureLabelForFile(
  data: AuditData,
  prefecture: string | null,
): PrefectureLabelResolution {
  if (!prefecture) return { status: "unresolved" }
  const labels = new Set(
    (data.hallsByPrefecture.get(prefecture) ?? []).map((hall) => hall.prefecture),
  )
  if (labels.size !== 1) return { status: "unresolved" }
  return { status: "resolved", label: [...labels][0] }
}

type PrefectureLabelResolution =
  | { readonly status: "resolved"; readonly label: string }
  | { readonly status: "unresolved" }

type PairReference = WalkMinutesOverride | AiSummaryOverride | ExclusionOverride

type PairRuleOptions = {
  readonly entries: readonly PairReference[]
  readonly file: string
  readonly entityType: string
  readonly hallCode: string
  readonly restaurantCode: string
  readonly duplicateCode: string
}

function checkPairReferences(
  data: AuditData,
  options: PairRuleOptions,
): readonly AuditIssue[] {
  const referenceIssues = options.entries.flatMap((entry, index) => {
    const location = pairLocation(entry, options.file, index)
    const issues: AuditIssue[] = []
    if (!data.indexes.hallById.has(entry.hall_id)) {
      issues.push(
        createAuditIssue({
          code: options.hallCode,
          severity: "error",
          entityType: options.entityType,
          entityId: location.entityId,
          file: options.file,
          message: "override または exclusion の hall_id 参照先がありません",
          details: { hallId: entry.hall_id, location },
          autoFixable: false,
        }),
      )
    }
    if (!data.indexes.restaurantById.has(entry.restaurant_id)) {
      issues.push(
        createAuditIssue({
          code: options.restaurantCode,
          severity: "error",
          entityType: options.entityType,
          entityId: location.entityId,
          file: options.file,
          message: "override または exclusion の restaurant_id 参照先がありません",
          details: { restaurantId: entry.restaurant_id, location },
          autoFixable: false,
        }),
      )
    }
    return issues
  })

  const pairs = options.entries.map((entry, index) => ({
    entry,
    location: pairLocation(entry, options.file, index),
  }))
  const duplicateIssues = [...groupBy(pairs, ({ location }) => location.entityId ?? "").entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([pair, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code: options.duplicateCode,
        severity: "error",
        entityType: options.entityType,
        entityId: pair,
        file: options.file,
        message: "同じ hall_id と restaurant_id のペアが重複しています",
        details: {
          hallId: group[0].entry.hall_id,
          restaurantId: group[0].entry.restaurant_id,
          locations,
        },
        autoFixable: false,
      })
    })

  return [...referenceIssues, ...duplicateIssues]
}

function pairLocation(entry: PairReference, file: string, index: number): EntityLocation {
  return {
    entityId: `${entry.hall_id}|${entry.restaurant_id}`,
    file,
    prefecture: null,
    index,
  }
}
