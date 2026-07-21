import { generateMapEmbedUrl, getGoogleMapsPlaceUrl } from "../../lib/maps"
import { PREFECTURE_BOUNDING_BOXES } from "./geo-config"
import { createAuditIssue } from "./report"
import {
  compareStrings,
  getHallLocations,
  groupBy,
  isBlank,
  sortLocations,
  sortedUnique,
  type LocatedEntity,
} from "./rule-utils"
import {
  HALL_DESCRIPTION_SIMILARITY_MIN_LENGTH,
  HALL_DESCRIPTION_SIMILARITY_THRESHOLD,
  bigramJaccardSimilarity,
  normalizeHallName,
  normalizeHallText,
} from "./text-similarity"
import type { AuditData, AuditIssue } from "./types"

/** S1-03 のホール監査で checkedRules に加算するルールコード。 */
export const HALL_RULE_CODES = [
  "HALL_OFFICIAL_NAME_MISSING",
  "HALL_ADDRESS_MISSING",
  "HALL_COORD_MISSING",
  "HALL_COORD_FORMAT",
  "HALL_COORD_SWAPPED",
  "HALL_COORD_OUTSIDE_PREFECTURE",
  "HALL_COORD_DUPLICATE",
  "HALL_COORD_LOW_PRECISION",
  "HALL_MAP_URL_INVALID",
  "HALL_NAME_DUPLICATE",
  "HALL_DESCRIPTION_DUPLICATE",
  "HALL_DESCRIPTION_SIMILAR",
] as const

export const HALL_RULE_COUNT = HALL_RULE_CODES.length

type HallEntry = LocatedEntity<AuditData["halls"][number]>
type DescriptionField = "pachiya_comment" | "meal_guide"

const EXPLICIT_PLACEHOLDERS = new Set([
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

const DESCRIPTION_FIELDS: readonly DescriptionField[] = ["pachiya_comment", "meal_guide"]

/**
 * S1-03 はホール固有の内容・座標・重複・Maps URL を検査する。
 * ID、必須項目、area/chain 参照は S1-02 の責務なのでここでは重複させない。
 */
export function checkHalls(data: AuditData): readonly AuditIssue[] {
  const halls = getHallLocations(data)
  return [
    ...checkNames(halls),
    ...checkAddresses(halls),
    ...checkCoordinates(halls),
    ...checkDescriptions(halls),
    ...checkMapUrls(halls),
  ]
}

function checkNames(entries: readonly HallEntry[]): readonly AuditIssue[] {
  const placeholderIssues = entries.flatMap(({ entity: hall, location }) => {
    if (!isExplicitPlaceholder(hall.name)) return []
    return [
      createAuditIssue({
        code: "HALL_OFFICIAL_NAME_MISSING",
        severity: "error",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "ホール名に確定前またはテスト用の表記が含まれています",
        details: { name: hall.name, reason: "explicit_placeholder", location },
        autoFixable: false,
      }),
    ]
  })

  const duplicateIssues = [...groupBy(entries, ({ entity, location }) =>
    `${location.prefecture ?? ""}\u0000${normalizeHallName(entity.name)}`,
  ).entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code: "HALL_NAME_DUPLICATE",
        severity: "warning",
        entityType: "hall",
        entityId: null,
        file: locations[0]?.file ?? null,
        message: "同一都道府県ファイル内で正規化後のホール名が重複しています",
        details: {
          normalizedName: normalizeHallName(group[0]?.entity.name ?? ""),
          prefectureFile: group[0]?.location.prefecture ?? null,
          hallPrefectures: sortedUnique(group.map(({ entity }) => entity.prefecture)),
          hallIds: locations.map((location) => location.entityId ?? ""),
          locations,
        },
        autoFixable: false,
      })
    })

  return [...placeholderIssues, ...duplicateIssues]
}

function checkAddresses(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: hall, location }) => {
    const normalized = normalizeHallText(hall.address)
    const reason = getAddressErrorReason(normalized)
    if (reason) {
      return [
        createAuditIssue({
          code: "HALL_ADDRESS_MISSING",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "ホール住所が監査に必要な地域情報を満たしていません",
          details: { address: hall.address, reason, location },
          autoFixable: false,
        }),
      ]
    }

    const warningReasons = getAddressWarningReasons(normalized, hall.prefecture)
    if (warningReasons.length === 0) return []
    return [
      createAuditIssue({
        code: "HALL_ADDRESS_MISSING",
        severity: "warning",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "ホール住所の粒度または都道府県表記を確認してください",
        details: { address: hall.address, reasons: warningReasons, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkCoordinates(entries: readonly HallEntry[]): readonly AuditIssue[] {
  const validEntries: HallEntry[] = []
  const formatIssues: AuditIssue[] = []

  for (const entry of entries) {
    const { entity: hall, location } = entry
    const lat = hall.lat as unknown
    const lng = hall.lng as unknown
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      formatIssues.push(
        createAuditIssue({
          code: "HALL_COORD_MISSING",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "ホール座標が設定されていません",
          details: { lat: coordinateDetailValue(lat), lng: coordinateDetailValue(lng), location },
          autoFixable: false,
        }),
      )
      continue
    }
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      formatIssues.push(
        createAuditIssue({
          code: "HALL_COORD_FORMAT",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "ホール座標が有限の数値ではありません",
          details: {
            lat: coordinateDetailValue(lat),
            lng: coordinateDetailValue(lng),
            reason: "not_finite_number",
            location,
          },
          autoFixable: false,
        }),
      )
      continue
    }
    if (lat >= 122 && lat <= 154 && lng >= 24 && lng <= 46) {
      formatIssues.push(
        createAuditIssue({
          code: "HALL_COORD_SWAPPED",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "ホール座標の緯度と経度が入れ替わっている可能性があります",
          details: { lat, lng, reason: "japan_range_swapped", location },
          autoFixable: false,
        }),
      )
      continue
    }
    if (
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      lat < 24 ||
      lat > 46 ||
      lng < 122 ||
      lng > 154
    ) {
      formatIssues.push(
        createAuditIssue({
          code: "HALL_COORD_FORMAT",
          severity: "error",
          entityType: "hall",
          entityId: hall.id,
          file: location.file,
          message: "ホール座標が日本の想定範囲外です",
          details: { lat, lng, reason: "outside_japan_range", location },
          autoFixable: false,
        }),
      )
      continue
    }
    validEntries.push(entry)
  }

  return [
    ...formatIssues,
    ...checkPrefectureBoundingBoxes(validEntries),
    ...checkCoordinatePrecision(validEntries),
    ...checkCoordinateDuplicates(validEntries, 6),
    ...checkCoordinateDuplicates(validEntries, 4),
  ]
}

function checkPrefectureBoundingBoxes(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: hall, location }) => {
    const boundingBox = PREFECTURE_BOUNDING_BOXES.get(hall.prefecture)
    if (!boundingBox || isInsideBoundingBox(hall.lat, hall.lng, boundingBox)) return []
    return [
      createAuditIssue({
        code: "HALL_COORD_OUTSIDE_PREFECTURE",
        severity: "warning",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "ホール座標が都道府県の粗い想定範囲外です",
        details: { lat: hall.lat, lng: hall.lng, prefecture: hall.prefecture, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkCoordinatePrecision(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: hall, location }) => {
    const latPrecision = decimalPlaces(hall.lat)
    const lngPrecision = decimalPlaces(hall.lng)
    if (latPrecision >= 4 && lngPrecision >= 4) return []
    return [
      createAuditIssue({
        code: "HALL_COORD_LOW_PRECISION",
        severity: "warning",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "ホール座標の小数精度が低いため確認してください",
        details: { lat: hall.lat, lng: hall.lng, latPrecision, lngPrecision, location },
        autoFixable: false,
      }),
    ]
  })
}

function checkCoordinateDuplicates(
  entries: readonly HallEntry[],
  precision: 4 | 6,
): readonly AuditIssue[] {
  return [...groupBy(entries, ({ entity }) => coordinateKey(entity.lat, entity.lng, precision)).entries()]
    .filter(([, group]) => {
      if (precision === 4) {
        if (group.length < 3) return false
        const exactCoordinateGroups = new Set(
          group.map(({ entity }) => coordinateKey(entity.lat, entity.lng, 6)),
        )
        return exactCoordinateGroups.size > 1
      }
      const hallIds = new Set(group.map(({ entity }) => entity.id))
      const addresses = new Set(group.map(({ entity }) => normalizeHallText(entity.address)))
      return hallIds.size > 1 && addresses.size > 1
    })
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([coordinate, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code: "HALL_COORD_DUPLICATE",
        severity: "warning",
        entityType: "hall",
        entityId: null,
        file: locations[0]?.file ?? null,
        message:
          precision === 6
            ? "異なる住所のホールで座標が完全に一致しています"
            : "3件以上のホールで小数4桁に丸めた座標が一致しています",
        details: {
          coordinate,
          precision,
          occurrenceCount: locations.length,
          hallIds: locations.map((location) => location.entityId ?? ""),
          addresses: sortedUnique(group.map(({ entity }) => normalizeHallText(entity.address))),
          locations,
        },
        autoFixable: false,
      })
    })
}

function checkDescriptions(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return [
    ...checkIntraHallDescriptionDuplicates(entries),
    ...DESCRIPTION_FIELDS.flatMap((field) => checkCrossHallDescriptionDuplicates(entries, field)),
    ...DESCRIPTION_FIELDS.flatMap((field) => checkSimilarDescriptions(entries, field)),
  ]
}

function checkIntraHallDescriptionDuplicates(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: hall, location }) => {
    const comment = normalizeHallText(hall.pachiya_comment)
    const guide = normalizeHallText(hall.meal_guide)
    if (!comment || comment !== guide) return []
    return [
      createAuditIssue({
        code: "HALL_DESCRIPTION_DUPLICATE",
        severity: "error",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "同一ホールでホールコメントと食事ガイドが完全に重複しています",
        details: { fields: ["pachiya_comment", "meal_guide"], relation: "same_hall", location },
        autoFixable: false,
      }),
    ]
  })
}

function checkCrossHallDescriptionDuplicates(
  entries: readonly HallEntry[],
  field: DescriptionField,
): readonly AuditIssue[] {
  return [...groupBy(entries, ({ entity }) => normalizeHallText(entity[field])).entries()]
    .filter(([value, group]) => value.length > 0 && group.length > 1)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, group]) => {
      const locations = sortLocations(group.map(({ location }) => location))
      return createAuditIssue({
        code: "HALL_DESCRIPTION_DUPLICATE",
        severity: "error",
        entityType: "hall",
        entityId: null,
        file: locations[0]?.file ?? null,
        message: "異なるホール間で説明文が完全に重複しています",
        details: {
          field,
          relation: "cross_hall",
          occurrenceCount: locations.length,
          hallIds: locations.map((location) => location.entityId ?? ""),
          locations,
        },
        autoFixable: false,
      })
    })
}

function checkSimilarDescriptions(
  entries: readonly HallEntry[],
  field: DescriptionField,
): readonly AuditIssue[] {
  const candidates = entries.filter(
    ({ entity }) => normalizeHallText(entity[field]).length >= HALL_DESCRIPTION_SIMILARITY_MIN_LENGTH,
  )
  const issues: AuditIssue[] = []
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const leftEntry = candidates[left]
      const rightEntry = candidates[right]
      const leftText = normalizeHallText(leftEntry.entity[field])
      const rightText = normalizeHallText(rightEntry.entity[field])
      if (leftText === rightText) continue
      const similarity = bigramJaccardSimilarity(leftText, rightText)
      if (similarity < HALL_DESCRIPTION_SIMILARITY_THRESHOLD) continue
      const locations = sortLocations([leftEntry.location, rightEntry.location])
      issues.push(
        createAuditIssue({
          code: "HALL_DESCRIPTION_SIMILAR",
          severity: "warning",
          entityType: "hall",
          entityId: null,
          file: locations[0]?.file ?? null,
          message: "異なるホール間で説明文が非常に類似しています",
          details: {
            field,
            similarity: Number(similarity.toFixed(6)),
            threshold: HALL_DESCRIPTION_SIMILARITY_THRESHOLD,
            hallIds: locations.map((location) => location.entityId ?? ""),
            locations,
          },
          autoFixable: false,
        }),
      )
    }
  }
  return issues
}

function checkMapUrls(entries: readonly HallEntry[]): readonly AuditIssue[] {
  return entries.flatMap(({ entity: hall, location }) => {
    const expectedQuery = `${hall.name.trim()} ${hall.address.trim()}`.trim()
    let invalidEndpoints: readonly string[]
    try {
      invalidEndpoints = [
        ["embed", generateMapEmbedUrl(hall.name, undefined, { address: hall.address, latLng: hall })],
        ["place", getGoogleMapsPlaceUrl(hall.name, { address: hall.address, latLng: hall })],
      ].flatMap(([endpoint, url]) =>
        isValidGeneratedHallMapUrl(url, expectedQuery, endpoint) ? [] : [endpoint],
      )
    } catch {
      invalidEndpoints = ["generation"]
    }
    if (invalidEndpoints.length === 0) return []
    return [
      createAuditIssue({
        code: "HALL_MAP_URL_INVALID",
        severity: "error",
        entityType: "hall",
        entityId: hall.id,
        file: location.file,
        message: "生成した Google Maps URL がホール名と住所を安全に含んでいません",
        details: { invalidEndpoints, location },
        autoFixable: false,
      }),
    ]
  })
}

/** Maps URL の検証はネットワークに接続せず、生成結果の形式だけを確認する。 */
export function isValidGeneratedHallMapUrl(
  value: string,
  expectedQuery: string,
  endpoint: string,
): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    const query = endpoint === "embed" ? url.searchParams.get("q") : url.searchParams.get("query")
    if (!query || query !== expectedQuery || isCoordinateOnlyQuery(query)) return false
    if (endpoint === "embed") {
      return (
        url.hostname === "maps.google.com" &&
        url.pathname === "/maps" &&
        url.searchParams.get("output") === "embed"
      )
    }
    return (
      endpoint === "place" &&
      url.hostname === "www.google.com" &&
      url.pathname === "/maps/search/" &&
      url.searchParams.get("api") === "1"
    )
  } catch {
    return false
  }
}

function isExplicitPlaceholder(value: string): boolean {
  const normalized = normalizeHallName(value)
  return (
    EXPLICIT_PLACEHOLDERS.has(normalized) ||
    /^(?:仮称|未定)\s*(?:[（(][^）)]*[）)])?$/u.test(normalized)
  )
}

function getAddressErrorReason(value: string): string | null {
  if (isBlank(value)) return "blank"
  if (isExplicitPlaceholder(value)) return "explicit_placeholder"
  if (/^https?:\/\//iu.test(value)) return "url_only"
  if (/^[+-]?\d+(?:\.\d+)?\s*[,，]\s*[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return "coordinate_only"
  }
  if (!/[都道府県市区町村郡丁目番地号]/u.test(value)) return "region_missing"
  return null
}

function getAddressWarningReasons(value: string, prefecture: string): readonly string[] {
  const reasons: string[] = []
  if (value.length < 10) reasons.push("too_short")
  if (!/\d/u.test(value)) reasons.push("lot_number_missing")
  if (prefecture && !value.includes(prefecture)) reasons.push("prefecture_not_in_address")
  return reasons.sort(compareStrings)
}

function isInsideBoundingBox(
  lat: number,
  lng: number,
  boundingBox: { readonly minLat: number; readonly maxLat: number; readonly minLng: number; readonly maxLng: number },
): boolean {
  return (
    lat >= boundingBox.minLat &&
    lat <= boundingBox.maxLat &&
    lng >= boundingBox.minLng &&
    lng <= boundingBox.maxLng
  )
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase()
  const [base, exponentText] = text.split("e")
  const decimalLength = base.split(".")[1]?.length ?? 0
  const exponent = Number(exponentText ?? 0)
  return Math.max(0, decimalLength - exponent)
}

function coordinateKey(lat: number, lng: number, precision: number): string {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`
}

function isCoordinateOnlyQuery(value: string): boolean {
  return /^[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?$/u.test(value)
}

function coordinateDetailValue(value: unknown): string | number | boolean | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value)
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (value === undefined) return null
  return Object.prototype.toString.call(value)
}
