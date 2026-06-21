/**
 * validate-restaurant-data.mjs の警告を分類・集計し、優先度付きレポートを生成する。
 * データ修正は行わない（見える化専用）。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MAX_STRAIGHT_M = 800
const MAX_WALK_MINUTES = 10
const BBOX_PREFILTER_KM = 1.5
const DONBURI_CHAIN_RATIO_THRESHOLD = 0.4
const MAIN_GENRE_MIN = 2

const PREFECTURE_LABELS = {
  tokyo: "東京都",
  osaka: "大阪府",
  aichi: "愛知県",
  fukuoka: "福岡県",
  hokkaido: "北海道",
  miyagi: "宮城県",
}

const TIME_SHORT_CHAIN_PATTERNS = [
  /^吉野家/,
  /^松屋/,
  /^すき家/,
  /^なか卯/,
  /^マクドナルド/,
  /^丸亀製麺/,
  /^カレーハウスCoCo壱番屋/,
  /^CoCo壱番屋/,
]

const EXPECTATION_GENRES = new Set([
  "ラーメン",
  "カレー",
  "とんかつ",
  "カツ丼",
  "回転寿司",
  "焼肉",
  "寿司",
])

const MAIN_GENRES = ["ラーメン", "カレー", "回転寿司", "寿司", "焼肉", "とんかつ", "カツ丼"]

function haversineM(a, b) {
  const R = 6371008.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function estimateWalkMinutes(hall, r) {
  const direct = haversineM(hall, r)
  return Math.max(1, Math.ceil((direct * 1.3) / 80))
}

function withinBoundingBox(a, b, limitKm) {
  const latDiffKm = Math.abs(a.lat - b.lat) * 111
  if (latDiffKm > limitKm) return false
  const lngDiffKm = Math.abs(a.lng - b.lng) * 91
  return lngDiffKm <= limitKm
}

function isValidMapLatLng(latLng) {
  if (!latLng) return false
  const { lat, lng } = latLng
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 24 &&
    lat <= 46 &&
    lng >= 122 &&
    lng <= 154
  )
}

function decimalPlaces(n) {
  const s = String(n)
  if (!s.includes(".")) return 0
  return s.split(".")[1].length
}

function isLowPrecision(lat, lng) {
  return decimalPlaces(lat) <= 4 && decimalPlaces(lng) <= 4
}

function buildMapQuery(name, options = {}) {
  const custom = options.mapQuery?.trim()
  if (custom) return encodeURIComponent(custom)
  const address = options.address?.trim()
  if (address) return encodeURIComponent(`${name} ${address}`)
  return encodeURIComponent(name)
}

function buildPlaceMapEndpoint(name, options = {}) {
  const custom = options.mapQuery?.trim()
  if (custom) return encodeURIComponent(custom)
  const address = options.address?.trim()
  if (address) return encodeURIComponent(`${name} ${address}`)
  if (isValidMapLatLng(options.latLng)) {
    return encodeURIComponent(`${options.latLng.lat},${options.latLng.lng}`)
  }
  return encodeURIComponent(name)
}

function isCoordOnlyEncoded(encoded) {
  const decoded = decodeURIComponent(encoded)
  return /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(decoded)
}

function hallEmbedUrl(hall) {
  const q = buildPlaceMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
  })
  return `https://maps.google.com/maps?q=${q}&output=embed&z=17`
}

function hallPlaceUrl(hall) {
  const query = buildPlaceMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
  })
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function routeEmbedUrl(hall, restaurant) {
  const origin = buildPlaceMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
  })
  const destination = buildPlaceMapEndpoint(restaurant.name, {
    latLng: { lat: restaurant.lat, lng: restaurant.lng },
    address: restaurant.address,
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

function directionUrl(hall, restaurant) {
  const origin = buildPlaceMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
  })
  const destination = buildPlaceMapEndpoint(restaurant.name, {
    latLng: { lat: restaurant.lat, lng: restaurant.lng },
    address: restaurant.address,
  })
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}

function getHallMapQueryField(hall) {
  return hall.map_query ?? hall.googleMapsQuery ?? hall.mapQuery
}

function isNameOnlyMapQuery(mapQuery, name) {
  const trimmed = mapQuery?.trim()
  if (!trimmed) return false
  return trimmed === name.trim()
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

function isTimeShortChain(name) {
  return TIME_SHORT_CHAIN_PATTERNS.some((re) => re.test(name))
}

function isFabricatedName(name) {
  // 公式サイト等で実在確認済みの固有名店（汎用パターン誤検知を除外）
  const verifiedBrandPatterns = [/^とんかつ\s+にいむら/]
  if (verifiedBrandPatterns.some((re) => re.test(name))) return false

  const patterns = [
    /^とんかつ\s+(?!和幸)/,
    /^焼肉\s+(?!ライク|牛庵|牛太)/,
    /^ラーメン\s/,
    /^うどん\s/,
    /^そば\s/,
    /^スープカレー\s+(?!ジャングル|ボンベイ|カムイ|ガラク|キング)/,
    /^ホルモン焼\s/,
    /^焼鳥\s/,
    /^博多ラーメン\s/,
    /^長浜ラーメン\s/,
    /^海鮮丼\s/,
    /^ジンギスカン\s/,
    /^もつ鍋\s/,
    /^カレー専門店\s/,
    /^カレー本舗\s/,
    /^博多一口餃子\s/,
    /^屋台ラーメン\s/,
    /^博多カレー本舗$/,
    /^かつ丼の名店\s/,
    /^とん平\s/,
    /^ラーメン人生\s/,
    /^廻る寿司\s/,
    /^元祖寿司\s/,
    /^勝ち牛\s/,
    /^なると屋\s/,
    /^きしめん\s+名古屋/,
    /^きしめん\s+名鉄/,
    /^カレーキング\s/,
    /^神代カレー\s/,
    /^スパイス食堂\s/,
    /^ボルケーノ\s/,
    /^かつ喜\s/,
    /^なだいかつ丼\s/,
    /^とんかつ丸福\s/,
    /^うどん匠\s/,
  ]
  return patterns.some((re) => re.test(name))
}

function isSeedCoordSuspicion(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  const latStr = String(lat)
  const lngStr = String(lng)
  const roundEnding =
    /\.0+$/.test(latStr) ||
    /\.0+$/.test(lngStr) ||
    (!latStr.includes(".") && !lngStr.includes("."))
  return roundEnding && isLowPrecision(lat, lng)
}

function isAmbiguousAddress(address) {
  const a = address?.trim()
  if (!a) return false
  const hasStreetNumber = /[0-9０-９]/.test(a)
  const hasChome = /[0-9０-９一二三四五六七八九十]+丁目/.test(a)
  return !hasStreetNumber && !hasChome
}

function isCommercialFacilityIncomplete(hallOrRestaurant) {
  const name = hallOrRestaurant.name ?? ""
  const address = hallOrRestaurant.address ?? ""
  const facilityHints = /ビル|モール|タワー|プラザ|センター|パーク|City|city|館|アリオ|イオン|マルイ|デパート|百貨店/
  const floorHints = /[0-9０-９]+[FfＦ]|地下[0-9０-９]|B[0-9０-９]|[0-9０-９]+階/
  return facilityHints.test(name) && !floorHints.test(address)
}

function isExpectationMealCandidate(restaurant) {
  if (isTimeShortChain(restaurant.name)) return false
  if (restaurant.is_kitaichimeshi === true) return true
  if (restaurant.selection_tags?.includes("notable_restaurant")) return true
  if (restaurant.selection_tags?.includes("local_famous")) return true
  if (EXPECTATION_GENRES.has(restaurant.genre)) return true
  const specialtyPatterns = [
    /ラーメン/,
    /カレー/,
    /とんかつ/,
    /カツ/,
    /寿司/,
    /焼肉/,
    /うどん専門/,
    /そば専門/,
  ]
  return specialtyPatterns.some((re) => re.test(restaurant.name))
}

function isLocalFood(restaurant) {
  return (
    restaurant.is_kitaichimeshi === true ||
    restaurant.selection_tags?.includes("local_famous") === true
  )
}

function coordKey4(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`
}

function addWarning(warnings, entry) {
  warnings.push(entry)
}

function initCounter() {
  return { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, total: 0 }
}

function bumpCounter(counter, priority) {
  counter[priority]++
  counter.total++
}

function mergeCounter(target, source) {
  for (const p of ["P0", "P1", "P2", "P3", "P4"]) {
    target[p] += source[p]
  }
  target.total += source.total
}

function counterFromWarnings(warningList) {
  const c = initCounter()
  for (const w of warningList) bumpCounter(c, w.priority)
  return c
}

function formatCounterRow(label, counter) {
  return counterToCells(label, counter).join(" | ")
}

function formatMarkdownTable(headers, rows) {
  const sep = headers.map(() => "---")
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ]
  return lines.join("\n")
}

const overridesPath = path.join(root, "data/overrides/walk-minutes.json")
const exclusionsPath = path.join(root, "data/overrides/exclusions.json")
const walkOverrides = fs.existsSync(overridesPath) ? loadJson(overridesPath) : []
const exclusions = fs.existsSync(exclusionsPath) ? loadJson(exclusionsPath) : []
const areas = fs.existsSync(path.join(root, "data/areas.json"))
  ? loadJson(path.join(root, "data/areas.json"))
  : []
const areaNameById = new Map(areas.map((a) => [a.id, a.name]))

const overrideIndex = new Map(
  walkOverrides.map((o) => [`${o.hall_id}|${o.restaurant_id}`, o]),
)
const exclusionIndex = new Set(
  exclusions.map((e) => `${e.hall_id}|${e.restaurant_id}`),
)

function matchForHall(hall, restaurants) {
  const matches = []
  for (const r of restaurants) {
    if (exclusionIndex.has(`${hall.id}|${r.id}`)) continue
    if (!withinBoundingBox(hall, r, BBOX_PREFILTER_KM)) continue
    const dist = haversineM(hall, r)
    if (dist > MAX_STRAIGHT_M) continue
    const override = overrideIndex.get(`${hall.id}|${r.id}`)
    const walkMinutes = override
      ? override.walkMinutes
      : estimateWalkMinutes(hall, r)
    if (walkMinutes > MAX_WALK_MINUTES) continue
    matches.push({ restaurant: r, walkMinutes, dist })
  }
  matches.sort((a, b) => {
    if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes
    return a.restaurant.id.localeCompare(b.restaurant.id)
  })
  return matches
}

const warnings = []
const hallMeta = new Map()
const hallPublished = new Map()
const allHalls = []
const allRestaurants = []

const prefDirs = fs
  .readdirSync(path.join(root, "data/prefectures"))
  .filter((p) => fs.existsSync(path.join(root, "data/prefectures", p, "halls.json")))

for (const prefFile of prefDirs) {
  const halls = loadJson(path.join(root, "data/prefectures", prefFile, "halls.json"))
  const restaurants = loadJson(
    path.join(root, "data/prefectures", prefFile, "restaurants.json"),
  )

  for (const hall of halls) {
    const enriched = {
      ...hall,
      prefecture_file: prefFile,
      prefecture_label: hall.prefecture ?? PREFECTURE_LABELS[prefFile] ?? prefFile,
      area_name: areaNameById.get(hall.area_id) ?? hall.area_id,
    }
    allHalls.push(enriched)
    hallMeta.set(hall.id, enriched)
  }
  for (const r of restaurants) {
    allRestaurants.push({ ...r, prefecture_file: prefFile })
  }

  for (const hall of halls) {
    const meta = hallMeta.get(hall.id)
    const matches = matchForHall(hall, restaurants)
    hallPublished.set(hall.id, matches)

    const base = {
      hallId: hall.id,
      hallName: hall.name,
      prefectureFile: prefFile,
      prefecture: meta.prefecture_label,
      areaId: hall.area_id,
      areaName: meta.area_name,
    }

    if (matches.length === 0) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "zero_restaurants",
        message: "掲載飲食店0件",
      })
    } else if (matches.length < 5) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "under5_restaurants",
        message: `掲載飲食店${matches.length}件（5件未満）`,
      })
    }

    const mapQueryField = getHallMapQueryField(hall)
    if (mapQueryField) {
      const expectedQuery = `${hall.name} ${hall.address}`.trim()
      if (mapQueryField.trim() !== expectedQuery) {
        addWarning(warnings, {
          ...base,
          priority: "P1",
          category: "map_query_mismatch",
          message: `map_query が name+address と不一致`,
        })
      }
      if (isNameOnlyMapQuery(mapQueryField, hall.name)) {
        addWarning(warnings, {
          ...base,
          priority: "P1",
          category: "name_only_map_query",
          message: "map_query が店名のみ",
        })
      }
    }

    if (!hall.address?.trim()) {
      addWarning(warnings, {
        ...base,
        priority: "P0",
        category: "empty_address",
        message: "ホール address が空",
      })
    } else if (isAmbiguousAddress(hall.address)) {
      addWarning(warnings, {
        ...base,
        priority: "P2",
        category: "ambiguous_address",
        message: "ホール住所表記が曖昧（丁目・番地不足の疑い）",
      })
    }

    if (isCommercialFacilityIncomplete(hall)) {
      addWarning(warnings, {
        ...base,
        priority: "P1",
        category: "facility_address_incomplete",
        message: "商業施設名があるが住所に階数・施設表記が不足",
      })
    }

    const hasCoords = isValidMapLatLng(hall)
    if (!hasCoords) {
      addWarning(warnings, {
        ...base,
        priority: "P0",
        category: "hall_missing_coords",
        message: "ホール lat/lng 欠損または無効",
      })
    } else {
      if (isSeedCoordSuspicion(hall.lat, hall.lng)) {
        addWarning(warnings, {
          ...base,
          priority: "P0",
          category: "seed_coord_suspicion",
          message: `ホール座標が seed 由来疑い (${hall.lat}, ${hall.lng})`,
        })
      }
      if (isLowPrecision(hall.lat, hall.lng)) {
        addWarning(warnings, {
          ...base,
          priority: "P2",
          category: "hall_low_precision_coords",
          message: `ホール低精度座標 (${hall.lat}, ${hall.lng})`,
        })
      }
    }

    const embedUrl = hallEmbedUrl(hall)
    const placeUrl = hallPlaceUrl(hall)
    const expectedNameAddress = buildMapQuery(hall.name, { address: hall.address })

    if (hall.address?.trim()) {
      if (embedUrl.includes(`q=${encodeURIComponent(`${hall.lat},${hall.lng}`)}`)) {
        addWarning(warnings, {
          ...base,
          priority: "P0",
          category: "coord_only_embed_url",
          message: "ホール embed URL が座標のみ（住所あり）",
        })
      }
      if (placeUrl.includes(`query=${encodeURIComponent(`${hall.lat},${hall.lng}`)}`)) {
        addWarning(warnings, {
          ...base,
          priority: "P0",
          category: "coord_only_place_url",
          message: "ホール place URL が座標のみ（住所あり）",
        })
      }
    }

    for (const { restaurant: r, dist, walkMinutes } of matches) {
      const restBase = {
        ...base,
        restaurantId: r.id,
        restaurantName: r.name,
      }

      if (dist > MAX_STRAIGHT_M * 0.9) {
        addWarning(warnings, {
          ...restBase,
          priority: "P1",
          category: "near_distance_limit",
          message: `直線距離 ${Math.round(dist)}m（上限 ${MAX_STRAIGHT_M}m 付近）`,
        })
      }
      if (walkMinutes >= MAX_WALK_MINUTES) {
        addWarning(warnings, {
          ...restBase,
          priority: "P1",
          category: "near_walk_limit",
          message: `徒歩 ${walkMinutes} 分（上限 ${MAX_WALK_MINUTES} 分付近）`,
        })
      }

      if (!r.lat || !r.lng) {
        addWarning(warnings, {
          ...restBase,
          priority: "P0",
          category: "restaurant_missing_coords",
          message: "飲食店 lat/lng 欠損",
        })
        continue
      }

      if (!r.address?.trim()) {
        addWarning(warnings, {
          ...restBase,
          priority: "P0",
          category: "empty_address",
          message: "飲食店 address が空",
        })
      } else if (isAmbiguousAddress(r.address)) {
        addWarning(warnings, {
          ...restBase,
          priority: "P2",
          category: "ambiguous_address",
          message: "飲食店住所表記が曖昧",
        })
      }

      if (isCommercialFacilityIncomplete(r)) {
        addWarning(warnings, {
          ...restBase,
          priority: "P1",
          category: "facility_address_incomplete",
          message: "商業施設内店舗だが住所に階数不足",
        })
      }

      if (isFabricatedName(r.name)) {
        addWarning(warnings, {
          ...restBase,
          priority: "P0",
          category: "fabricated_name_suspicion",
          message: `実在性疑いの店名パターン: ${r.name}`,
        })
      }

      if (isSeedCoordSuspicion(r.lat, r.lng)) {
        addWarning(warnings, {
          ...restBase,
          priority: "P0",
          category: "seed_coord_suspicion",
          message: `飲食店座標が seed 由来疑い (${r.lat}, ${r.lng})`,
        })
      }

      const lowPrec = isLowPrecision(r.lat, r.lng)
      if (lowPrec) {
        const topRank = matches.findIndex((m) => m.restaurant.id === r.id)
        const expectation = isExpectationMealCandidate(r)
        const priority =
          expectation || topRank < 5 || r.is_kitaichimeshi
            ? "P1"
            : "P2"
        addWarning(warnings, {
          ...restBase,
          priority,
          category: "restaurant_low_precision_coords",
          message: `低精度座標 (${r.lat}, ${r.lng})${expectation ? " [期待値飯候補]" : ""}${topRank < 5 ? " [上位表示]" : ""}`,
        })
      }

      const url = routeEmbedUrl(hall, r)
      if (hall.address?.trim() && r.address?.trim()) {
        const originPart = url.match(/saddr=([^&]+)/)?.[1]
        const destPart = url.match(/daddr=([^&]+)/)?.[1]
        if (originPart && isCoordOnlyEncoded(originPart)) {
          addWarning(warnings, {
            ...restBase,
            priority: "P0",
            category: "coord_only_direction_url",
            message: "経路 embed saddr が座標のみ",
          })
        }
        if (destPart && isCoordOnlyEncoded(destPart)) {
          addWarning(warnings, {
            ...restBase,
            priority: "P0",
            category: "coord_only_direction_url",
            message: "経路 embed daddr が座標のみ",
          })
        }
      }

      if (
        hall.address?.trim() &&
        r.address?.trim() &&
        !r.address.includes(hall.city ?? "") &&
        hall.prefecture &&
        !r.address.includes(hall.prefecture.replace(/[都道府県]$/, ""))
      ) {
        addWarning(warnings, {
          ...restBase,
          priority: "P1",
          category: "name_address_region_mismatch",
          message: "店名と住所の地域整合性に疑い",
        })
      }
    }

    const published = matches.map((m) => m.restaurant)
    const donburiCount = published.filter((r) => isTimeShortChain(r.name)).length
    const ratio = published.length > 0 ? donburiCount / published.length : 0
    if (published.length >= 5 && ratio >= DONBURI_CHAIN_RATIO_THRESHOLD) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "donburi_chain_skew",
        message: `丼ものチェーン比率 ${Math.round(ratio * 100)}% (${donburiCount}/${published.length})`,
      })
    }

    const expectationCount = published.filter(isExpectationMealCandidate).length
    if (published.length >= 3 && expectationCount === 0) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "no_expectation_meal",
        message: "期待値飯候補0件",
      })
    }

    const localCount = published.filter(isLocalFood).length
    if (published.length >= 3 && localCount === 0) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "no_local_food",
        message: "地場飯（kitaichimeshi/local_famous）0件",
      })
    }

    const mainGenreCount = published.filter((r) => MAIN_GENRES.includes(r.genre)).length
    if (published.length >= 5 && mainGenreCount < MAIN_GENRE_MIN) {
      addWarning(warnings, {
        ...base,
        priority: "P3",
        category: "low_main_genre_diversity",
        message: `主力ジャンル（ラーメン/カレー/寿司/焼肉/とんかつ等）が ${mainGenreCount} 件のみ`,
      })
    }
  }
}

const hallCoordGroups = new Map()
const restCoordGroups = new Map()
for (const h of allHalls) {
  if (!isValidMapLatLng(h)) continue
  const key = coordKey4(h.lat, h.lng)
  if (!hallCoordGroups.has(key)) hallCoordGroups.set(key, [])
  hallCoordGroups.get(key).push(h.id)
}
for (const r of allRestaurants) {
  if (!r.lat || !r.lng) continue
  const key = coordKey4(r.lat, r.lng)
  if (!restCoordGroups.has(key)) restCoordGroups.set(key, [])
  restCoordGroups.get(key).push(r.id)
}

const publishedRestaurantIds = new Set()
for (const matches of hallPublished.values()) {
  for (const m of matches) publishedRestaurantIds.add(m.restaurant.id)
}

for (const [coords, ids] of hallCoordGroups.entries()) {
  if (ids.length < 2) continue
  for (const hallId of ids) {
    const meta = hallMeta.get(hallId)
    addWarning(warnings, {
      hallId,
      hallName: meta.name,
      prefectureFile: meta.prefecture_file,
      prefecture: meta.prefecture_label,
      areaId: meta.area_id,
      areaName: meta.area_name,
      priority: ids.length >= 3 ? "P0" : "P1",
      category: "duplicate_hall_coords",
      message: `同一座標 ${coords} を ${ids.length} ホールが共有 (${ids.join(", ")})`,
    })
  }
}

for (const [coords, ids] of restCoordGroups.entries()) {
  const published = ids.filter((id) => publishedRestaurantIds.has(id))
  if (published.length < 3) continue
  for (const restaurantId of published) {
    const r = allRestaurants.find((x) => x.id === restaurantId)
    if (!r) continue
    const hallsUsing = [...hallPublished.entries()]
      .filter(([, ms]) => ms.some((m) => m.restaurant.id === restaurantId))
      .map(([hallId]) => hallId)
    const hallId = hallsUsing[0]
    const meta = hallMeta.get(hallId)
    if (!meta) continue
    addWarning(warnings, {
      hallId,
      hallName: meta.name,
      restaurantId,
      restaurantName: r.name,
      prefectureFile: meta.prefecture_file,
      prefecture: meta.prefecture_label,
      areaId: meta.area_id,
      areaName: meta.area_name,
      priority: published.length >= 5 ? "P0" : "P1",
      category: "duplicate_restaurant_coords",
      message: `同一座標 ${coords} を掲載店 ${published.length} 件が共有`,
    })
  }
}

const overall = counterFromWarnings(warnings)

const byPrefecture = new Map()
const byArea = new Map()
const byHall = new Map()

for (const w of warnings) {
  if (!byPrefecture.has(w.prefecture)) byPrefecture.set(w.prefecture, [])
  byPrefecture.get(w.prefecture).push(w)

  const areaKey = `${w.prefecture}|${w.areaId}`
  if (!byArea.has(areaKey)) {
    byArea.set(areaKey, { prefecture: w.prefecture, areaId: w.areaId, areaName: w.areaName, warnings: [] })
  }
  byArea.get(areaKey).warnings.push(w)

  if (w.hallId) {
    if (!byHall.has(w.hallId)) {
      byHall.set(w.hallId, {
        hallId: w.hallId,
        hallName: w.hallName,
        areaName: w.areaName,
        prefecture: w.prefecture,
        warnings: [],
        notes: [],
      })
    }
    byHall.get(w.hallId).warnings.push(w)
  }
}

for (const [hallId, bucket] of byHall.entries()) {
  const cats = new Set(bucket.warnings.map((w) => w.category))
  if (cats.has("zero_restaurants")) bucket.notes.push("掲載0")
  if (cats.has("under5_restaurants")) bucket.notes.push("掲載不足")
  if (cats.has("donburi_chain_skew")) bucket.notes.push("丼チェーン偏重")
  if (cats.has("no_expectation_meal")) bucket.notes.push("期待値飯不足")
  if (cats.has("no_local_food")) bucket.notes.push("地場飯不足")
  if (bucket.warnings.some((w) => w.priority === "P0")) bucket.notes.push("P0あり")
}

function counterToCells(label, counter) {
  return [label, String(counter.P0), String(counter.P1), String(counter.P2), String(counter.P3), String(counter.P4), String(counter.total)]
}

const hallRows = [...byHall.values()]
  .map((h) => {
    const c = counterFromWarnings(h.warnings)
    return [
      h.hallId,
      h.hallName,
      h.areaName,
      String(c.P0),
      String(c.P1),
      String(c.P2),
      String(c.P3),
      String(c.P4),
      String(c.total),
      h.notes.join(", ") || "-",
    ]
  })
  .sort((a, b) => {
    const score = (row) => Number(row[3]) * 1000 + Number(row[4]) * 100 + Number(row[8])
    return score(b) - score(a)
  })

const dangerHalls = hallRows
  .filter((r) => Number(r[3]) > 0 || Number(r[4]) > 0)
  .slice(0, 30)

const dangerAreas = [...byArea.values()]
  .map((a) => ({
    prefecture: a.prefecture,
    areaName: a.areaName,
    counter: counterFromWarnings(a.warnings),
  }))
  .filter((a) => a.counter.P0 > 0 || a.counter.P1 > 0)
  .sort(
    (a, b) =>
      b.counter.P0 * 1000 +
      b.counter.P1 * 10 -
      (a.counter.P0 * 1000 + a.counter.P1 * 10),
  )
  .slice(0, 20)

const under5Halls = hallRows.filter((r) => r[9].includes("掲載不足") || r[9].includes("掲載0"))
const donburiSkewHalls = hallRows.filter((r) => r[9].includes("丼チェーン偏重"))
const noExpectationHalls = hallRows.filter((r) => r[9].includes("期待値飯不足"))

const categoryCounts = new Map()
for (const w of warnings) {
  const key = `${w.priority}|${w.category}`
  categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1)
}
const categoryRows = [...categoryCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([key, count]) => {
    const [priority, category] = key.split("|")
    return `| ${priority} | ${category} | ${count} |`
  })

const generatedAt = new Date().toISOString()
const report = `# validate 警告分析レポート

生成日時: ${generatedAt}

> 本レポートは \`scripts/analyze-validate-warnings.mjs\` により自動生成。データ修正は行っていません。

## 1. 全体サマリー

| 項目 | 件数 |
| ---- | ---: |
| 総警告数 | ${overall.total} |
| P0（即対応） | ${overall.P0} |
| P1（優先確認） | ${overall.P1} |
| P2（順次改善） | ${overall.P2} |
| P3（コンテンツ品質） | ${overall.P3} |
| P4（後回し） | ${overall.P4} |

## 2. 警告分類ルール（カテゴリ別件数）

| 優先度 | カテゴリ | 件数 |
| ---- | ---- | ---: |
${categoryRows.join("\n")}

### 優先度定義

| 優先度 | 意味 | 主なカテゴリ |
| ---- | ---- | ---- |
| P0 | 即対応 | 住所/座標欠損、Maps URL座標のみ、seed座標疑い、実在性疑い、大量座標使い回し |
| P1 | 優先確認 | map_query不一致、施設住所不足、期待値飯候補の低精度、距離/徒歩上限付近、座標重複 |
| P2 | 順次改善 | 低精度座標、住所表記の軽微な不足 |
| P3 | コンテンツ品質 | 掲載数不足、丼チェーン偏重、期待値飯/地場飯不足、ジャンル偏り |
| P4 | 後回し | （現状 validate 警告からは該当なし。将来の表記統一等用） |

## 3. 都道府県別集計

${formatMarkdownTable(
  ["都道府県", "P0", "P1", "P2", "P3", "P4", "合計"],
  [...byPrefecture.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([pref, list]) => counterToCells(pref, counterFromWarnings(list))),
)}

## 4. エリア別集計

${formatMarkdownTable(
  ["都道府県", "エリア", "P0", "P1", "P2", "P3", "P4", "合計"],
  [...byArea.values()]
    .sort((a, b) => {
      const p = a.prefecture.localeCompare(b.prefecture, "ja")
      return p !== 0 ? p : a.areaName.localeCompare(b.areaName, "ja")
    })
    .map((a) => {
      const c = counterFromWarnings(a.warnings)
      return [
        a.prefecture,
        a.areaName,
        String(c.P0),
        String(c.P1),
        String(c.P2),
        String(c.P3),
        String(c.P4),
        String(c.total),
      ]
    }),
)}

## 5. ホール別集計（P0+P1+合計の降順）

${formatMarkdownTable(
  ["ホールID", "ホール名", "エリア", "P0", "P1", "P2", "P3", "P4", "合計", "備考"],
  hallRows,
)}

## 6. 危険度上位（P0/P1 多い順）

### エリア TOP20

${formatMarkdownTable(
  ["都道府県", "エリア", "P0", "P1", "P2", "P3", "合計"],
  dangerAreas.map((a) => [
    a.prefecture,
    a.areaName,
    String(a.counter.P0),
    String(a.counter.P1),
    String(a.counter.P2),
    String(a.counter.P3),
    String(a.counter.total),
  ]),
)}

### ホール TOP30

${formatMarkdownTable(
  ["ホールID", "ホール名", "エリア", "P0", "P1", "P2", "P3", "合計", "備考"],
  dangerHalls.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[8], r[9]]),
)}

## 7. 掲載品質リスト

### 掲載数不足（5件未満 / 0件）

${formatMarkdownTable(
  ["ホールID", "ホール名", "エリア", "掲載数", "備考"],
  under5Halls.map((r) => {
    const count = hallPublished.get(r[0])?.length ?? 0
    return [r[0], r[1], r[2], String(count), r[9]]
  }),
)}

### 丼ものチェーン偏重

${formatMarkdownTable(
  ["ホールID", "ホール名", "エリア", "合計警告", "備考"],
  donburiSkewHalls.map((r) => [r[0], r[1], r[2], r[8], r[9]]),
)}

### 期待値飯候補不足

${formatMarkdownTable(
  ["ホールID", "ホール名", "エリア", "合計警告", "備考"],
  noExpectationHalls.map((r) => [r[0], r[1], r[2], r[8], r[9]]),
)}

## 8. 次に修正すべき優先順位（提案）

1. **P0 集中ホール・エリア** — 住所/座標欠損、Maps URL 座標のみ、seed 疑い、実在性疑いを手動確認
2. **P1 の期待値飯候補・上位表示店** — 低精度座標で誤誘導リスクがある店から座標・住所を検証
3. **同一座標の大量使い回し** — 掲載店5件以上で座標共有しているグループを個別確認
4. **P3 掲載品質** — 掲載0/不足ホール、丼チェーン偏重、期待値飯不足ホールへコンテンツ追加（推測追加は避ける）
5. **P2 低精度座標** — 一括機械修正はせず、利用頻度の高い店から順次

## 9. 参考：validate-restaurant-data との関係

本分析は \`validate-restaurant-data.mjs\` と同じ距離・Maps URL 判定ロジックを再利用し、
追加で seed 座標疑い・座標重複・コンテンツ品質（期待値飯/地場飯/チェーン比率）を分類しています。
既存 validator の ERROR/WARN 判定は変更していません。
`

const reportsDir = path.join(root, "scripts/reports")
fs.mkdirSync(reportsDir, { recursive: true })
const reportPath = path.join(reportsDir, "validate-warning-summary.md")
fs.writeFileSync(reportPath, report, "utf8")

console.log("[analyze-validate-warnings] report ->", reportPath)
console.log("")
console.log("=== 全体サマリー ===")
console.log(`総警告数: ${overall.total}`)
console.log(`P0: ${overall.P0}  P1: ${overall.P1}  P2: ${overall.P2}  P3: ${overall.P3}  P4: ${overall.P4}`)
console.log("")
console.log("=== 都道府県別 ===")
for (const [pref, list] of [...byPrefecture.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], "ja"),
)) {
  const c = counterFromWarnings(list)
  console.log(`${pref}: P0=${c.P0} P1=${c.P1} P2=${c.P2} P3=${c.P3} 合計=${c.total}`)
}
console.log("")
console.log("=== 危険度上位エリア (P0+P1) ===")
for (const a of dangerAreas.slice(0, 10)) {
  console.log(
    `${a.prefecture} / ${a.areaName}: P0=${a.counter.P0} P1=${a.counter.P1} 合計=${a.counter.total}`,
  )
}
console.log("")
console.log("=== 危険度上位ホール TOP10 ===")
for (const r of dangerHalls.slice(0, 10)) {
  console.log(`${r[0]} (${r[1]}): P0=${r[3]} P1=${r[4]} 合計=${r[8]} [${r[9]}]`)
}
console.log("")
console.log(`掲載不足ホール: ${under5Halls.length}件`)
console.log(`丼チェーン偏重: ${donburiSkewHalls.length}件`)
console.log(`期待値飯不足: ${noExpectationHalls.length}件`)
