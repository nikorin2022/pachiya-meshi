/**
 * ホール・飲食店座標 / マップURL / 距離表示の監査スクリプト
 * Google Maps API は使わず、データ上の論理チェックと URL 生成パターンを検証する。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MAX_STRAIGHT_M = 800
const MAX_WALK_MINUTES = 10
const FOCUS_PREFS = ["osaka", "aichi", "miyagi", "hokkaido"]

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

function estimateWalkMinutes(directM) {
  return Math.max(1, Math.ceil((directM * 1.3) / 80))
}

function buildMapQuery(name, address) {
  if (address?.trim()) return encodeURIComponent(`${name} ${address.trim()}`)
  return encodeURIComponent(name)
}

function routeEmbedUrl(originLatLng, destName, destAddress) {
  const origin = encodeURIComponent(`${originLatLng.lat},${originLatLng.lng}`)
  const dest = buildMapQuery(destName, destAddress)
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${dest}&dirflg=w&output=embed`
}

function hallEmbedUrl(hall) {
  const q = encodeURIComponent(`${hall.lat},${hall.lng}`)
  return `https://maps.google.com/maps?q=${q}&output=embed&z=17`
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

const prefDirs = fs
  .readdirSync(path.join(root, "data/prefectures"))
  .filter((p) => fs.existsSync(path.join(root, "data/prefectures", p, "halls.json")))

const halls = []
const restaurants = []
for (const pref of prefDirs) {
  const base = path.join(root, "data/prefectures", pref)
  for (const h of loadJson(path.join(base, "halls.json"))) {
    halls.push({ ...h, prefecture_file: pref })
  }
  for (const r of loadJson(path.join(base, "restaurants.json"))) {
    restaurants.push({ ...r, prefecture_file: pref })
  }
}

// --- タスク1: ホール座標監査 ---
const hallIssues = {
  missingCoords: [],
  duplicateCoords: [],
  roundedCoords: [], // 4桁以下の精度（おそらく手入力・丸め）
  focusPref: { osaka: [], aichi: [], miyagi: [], hokkaido: [] },
}

const coordKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`
const hallCoordGroups = new Map()

for (const h of halls) {
  if (!h.lat || !h.lng) {
    hallIssues.missingCoords.push(h.id)
    continue
  }
  const key = coordKey(h.lat, h.lng)
  if (!hallCoordGroups.has(key)) hallCoordGroups.set(key, [])
  hallCoordGroups.get(key).push(h.id)

  const latDec = (String(h.lat).split(".")[1] || "").length
  const lngDec = (String(h.lng).split(".")[1] || "").length
  if (latDec <= 3 && lngDec <= 3) {
    hallIssues.roundedCoords.push({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      address: h.address,
    })
  }

  if (FOCUS_PREFS.includes(h.prefecture_file)) {
    hallIssues.focusPref[h.prefecture_file].push({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      address: h.address,
    })
  }
}

for (const [key, ids] of hallCoordGroups) {
  if (ids.length > 1) {
    hallIssues.duplicateCoords.push({ coords: key, hallIds: ids })
  }
}

// --- タスク2: 飲食店座標監査 ---
const restaurantIssues = {
  missingCoords: [],
  duplicateCoords: [],
  roundedCoords: [],
  duplicateNames: [],
  nameOnlyDestinationRisk: [], // 同名・類似名で Google 誤解決リスク
}

const restCoordGroups = new Map()
const nameGroups = new Map()

for (const r of restaurants) {
  if (!r.lat || !r.lng) {
    restaurantIssues.missingCoords.push(r.id)
    continue
  }
  const key = coordKey(r.lat, r.lng)
  if (!restCoordGroups.has(key)) restCoordGroups.set(key, [])
  restCoordGroups.get(key).push(r.id)

  const latDec = (String(r.lat).split(".")[1] || "").length
  const lngDec = (String(r.lng).split(".")[1] || "").length
  if (latDec <= 3 && lngDec <= 3) {
    restaurantIssues.roundedCoords.push({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
    })
  }

  if (!nameGroups.has(r.name)) nameGroups.set(r.name, [])
  nameGroups.get(r.name).push(r.id)
}

for (const [name, ids] of nameGroups) {
  if (ids.length > 1) restaurantIssues.duplicateNames.push({ name, ids })
}

// チェーン店名のみ（支店名なし）や短い名前
for (const r of restaurants) {
  const generic =
    /^(吉野家|松屋|すき家|なか卯|カレーハウスCoCo壱番屋|一風堂|一蘭)\s/.test(r.name) === false &&
    !/店$/.test(r.name) &&
    r.name.length < 8
  const noBranch =
    (r.name.includes("吉野家") ||
      r.name.includes("松屋") ||
      r.name.includes("すき家") ||
      r.name.includes("なか卯") ||
      r.name.includes("CoCo") ||
      r.name.includes("一風堂") ||
      r.name.includes("一蘭")) &&
    !/店/.test(r.name)
  if (generic || noBranch) {
    restaurantIssues.nameOnlyDestinationRisk.push({
      id: r.id,
      name: r.name,
      reason: noBranch ? "chain_without_branch_suffix" : "short_name",
    })
  }
}

for (const [key, ids] of restCoordGroups) {
  if (ids.length > 1) {
    restaurantIssues.duplicateCoords.push({ coords: key, restaurantIds: ids })
  }
}

// --- タスク3/4/5/6: マッチング・距離・URL監査 ---
const matcherIssues = {
  /** データ上は10分圏だが直線1km超（Google実歩行と大乖離の可能性） */
  straightOver1km: [],
  /** 直線800m以内だが推定徒歩11分+（表示とGoogle乖離リスク） */
  walkOver10ButUnder800m: [],
  /** ホール名検索 vs 座標起点の不一致リスク（埋め込み地図とルート地図で起点が異なる） */
  hallEmbedVsRouteOriginMismatch: [],
  /** 飲食店終点が名称のみ（座標未使用） */
  destinationNameOnly: [],
  /** 粉やうめきた等の具体事例 */
  shikairiUmedaRoutes: [],
}

for (const hall of halls) {
  const areaRestaurants = restaurants.filter(
    (r) =>
      r.prefecture_file === hall.prefecture_file && r.area_id === hall.area_id,
  )

  matcherIssues.hallEmbedVsRouteOriginMismatch.push({
    hallId: hall.id,
    hallName: hall.name,
    hallEmbedUses: "lat_lng",
    routeOriginUses: "lat_lng",
    hallEmbedUrl: hallEmbedUrl(hall),
    routeSampleUrl:
      areaRestaurants[0]
        ? routeEmbedUrl(
            { lat: hall.lat, lng: hall.lng },
            areaRestaurants[0].name,
            areaRestaurants[0].address,
          )
        : null,
  })

  for (const r of areaRestaurants) {
    const d = haversineM(hall, r)
    const wm = estimateWalkMinutes(d)
    if (wm <= MAX_WALK_MINUTES) {
      matcherIssues.destinationNameOnly.push({
        hallId: hall.id,
        restaurantId: r.id,
        restaurantName: r.name,
        hasRestaurantLatLng: true,
        routeUsesDestination: "lat_lng",
        dataStraightM: Math.round(d),
        dataWalkMin: wm,
      })

      if (d > 1000) {
        matcherIssues.straightOver1km.push({
          hallId: hall.id,
          hallName: hall.name,
          restaurantId: r.id,
          restaurantName: r.name,
          straightM: Math.round(d),
          walkMin: wm,
        })
      }
      if (d <= MAX_STRAIGHT_M && wm > MAX_WALK_MINUTES) {
        matcherIssues.walkOver10ButUnder800m.push({
          hallId: hall.id,
          restaurantId: r.id,
          straightM: Math.round(d),
          walkMin: wm,
        })
      }
    }
  }

  if (hall.id === "shikairi-umeda") {
    for (const r of areaRestaurants) {
      const d = haversineM(hall, r)
      const wm = estimateWalkMinutes(d)
      if (wm <= MAX_WALK_MINUTES) {
        matcherIssues.shikairiUmedaRoutes.push({
          restaurant: r.name,
          address: r.address,
          straightM: Math.round(d),
          dataWalkMin: wm,
          routeUrl: routeEmbedUrl(
            { lat: hall.lat, lng: hall.lng },
            r.name,
            r.address,
          ),
          hallCoords: { lat: hall.lat, lng: hall.lng },
          restaurantCoords: { lat: r.lat, lng: r.lng },
        })
      }
    }
  }
}

// 集計
const hallsWithStraightOver1km = new Set(
  matcherIssues.straightOver1km.map((x) => x.hallId),
)
const restaurantsStraightOver1km = matcherIssues.straightOver1km.length
const hallsWithEmbedRouteMismatch = halls.length // 全ホールが name vs latlng 分岐

const report = {
  summary: {
    totalHalls: halls.length,
    totalRestaurants: restaurants.length,
    hallDuplicateCoordGroups: hallIssues.duplicateCoords.length,
    hallRoundedLowPrecision: hallIssues.roundedCoords.length,
    restaurantDuplicateCoordGroups: restaurantIssues.duplicateCoords.length,
    restaurantDuplicateNames: restaurantIssues.duplicateNames.length,
    restaurantRoundedLowPrecision: restaurantIssues.roundedCoords.length,
    matchedPairsStraightOver1km: matcherIssues.straightOver1km.length,
    hallsAffectedStraightOver1km: hallsWithStraightOver1km.size,
    destinationNameOnlyPairs: matcherIssues.destinationNameOnly.length,
    allHallsEmbedNameRouteCoords: hallsWithEmbedRouteMismatch,
    shikairiUmedaCase: matcherIssues.shikairiUmedaRoutes,
  },
  hallIssues,
  restaurantIssues,
  matcherIssues: {
    straightOver1km: matcherIssues.straightOver1km,
    walkOver10ButUnder800m: matcherIssues.walkOver10ButUnder800m,
    shikairiUmedaRoutes: matcherIssues.shikairiUmedaRoutes,
  },
  focusPrefHallCoords: hallIssues.focusPref,
}

const outPath = path.join(root, "scripts/audit-maps-coordinates-report.json")
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8")

console.log("[audit-maps-coordinates] report ->", outPath)
console.log(JSON.stringify(report.summary, null, 2))
