/**
 * 全地域ホール・飲食店座標の一括監査（抽出のみ）
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MAX_STRAIGHT_M = 800
const MAX_WALK_MINUTES = 10
const BBOX_PREFILTER_KM = 1.5

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

function decimalPlaces(n) {
  const s = String(n)
  if (!s.includes(".")) return 0
  return s.split(".")[1].length
}

function isLowPrecision(lat, lng) {
  return decimalPlaces(lat) <= 4 && decimalPlaces(lng) <= 4
}

function withinBoundingBox(a, b, limitKm) {
  const latDiffKm = Math.abs(a.lat - b.lat) * 111
  if (latDiffKm > limitKm) return false
  const lngDiffKm = Math.abs(a.lng - b.lng) * 91
  if (lngDiffKm > limitKm) return false
  return true
}

function estimateWalkMinutes(hall, r) {
  const direct = haversineM(hall, r)
  return Math.max(1, Math.ceil((direct * 1.3) / 80))
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

const overridesPath = path.join(root, "data/overrides/walk-minutes.json")
const exclusionsPath = path.join(root, "data/overrides/exclusions.json")
const walkOverrides = fs.existsSync(overridesPath) ? loadJson(overridesPath) : []
const exclusions = fs.existsSync(exclusionsPath) ? loadJson(exclusionsPath) : []
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
  return matches
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

const coordKey4 = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`

// Halls audit
const hallLowPrecision = []
const hallDuplicates = new Map()
for (const h of halls) {
  if (isLowPrecision(h.lat, h.lng)) {
    hallLowPrecision.push({
      id: h.id,
      name: h.name,
      area_id: h.area_id,
      prefecture_file: h.prefecture_file,
      lat: h.lat,
      lng: h.lng,
      latDec: decimalPlaces(h.lat),
      lngDec: decimalPlaces(h.lng),
      address: h.address,
    })
  }
  const key = coordKey4(h.lat, h.lng)
  if (!hallDuplicates.has(key)) hallDuplicates.set(key, [])
  hallDuplicates.get(key).push(h.id)
}

const hallDuplicateGroups = [...hallDuplicates.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([coords, ids]) => ({ coords, hallIds: ids }))

// Restaurants audit
const restLowPrecision = []
const restDuplicates = new Map()
for (const r of restaurants) {
  if (isLowPrecision(r.lat, r.lng)) {
    restLowPrecision.push({
      id: r.id,
      name: r.name,
      area_id: r.area_id,
      prefecture_file: r.prefecture_file,
      lat: r.lat,
      lng: r.lng,
      latDec: decimalPlaces(r.lat),
      lngDec: decimalPlaces(r.lng),
      address: r.address,
    })
  }
  const key = coordKey4(r.lat, r.lng)
  if (!restDuplicates.has(key)) restDuplicates.set(key, [])
  restDuplicates.get(key).push(r.id)
}

const restDuplicateGroups = [...restDuplicates.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([coords, ids]) => ({ coords, restaurantIds: ids, count: ids.length }))

// Published restaurants (matched to any hall)
const publishedIds = new Set()
for (const hall of halls) {
  const prefRestaurants = restaurants.filter(
    (r) => r.prefecture_file === hall.prefecture_file,
  )
  for (const m of matchForHall(hall, prefRestaurants)) {
    publishedIds.add(m.restaurant.id)
  }
}

const publishedLowPrecision = restLowPrecision.filter((r) => publishedIds.has(r.id))
const publishedInDuplicateGroups = restDuplicateGroups
  .filter((g) => g.restaurantIds.some((id) => publishedIds.has(id)))
  .map((g) => ({
    ...g,
    publishedIds: g.restaurantIds.filter((id) => publishedIds.has(id)),
  }))

const priorityAreas = [
  "nanba",
  "hakata",
  "tenjin",
  "sakae",
  "nagoya-ekimae",
  "sendai",
  "sapporo-ekimae",
  "tanukikoji",
]

const priorityHallLow = hallLowPrecision.filter(
  (h) => priorityAreas.includes(h.area_id) || h.prefecture_file === "tokyo",
)

const report = {
  summary: {
    totalHalls: halls.length,
    totalRestaurants: restaurants.length,
    publishedRestaurantCount: publishedIds.size,
    hallLowPrecisionCount: hallLowPrecision.length,
    hallDuplicateGroupCount: hallDuplicateGroups.length,
    restaurantLowPrecisionCount: restLowPrecision.length,
    restaurantDuplicateGroupCount: restDuplicateGroups.length,
    publishedLowPrecisionCount: publishedLowPrecision.length,
    publishedDuplicateGroupCount: publishedInDuplicateGroups.length,
  },
  hallLowPrecision,
  hallDuplicateGroups,
  priorityHallLowPrecision: priorityHallLow,
  restaurantLowPrecision: restLowPrecision,
  restaurantDuplicateGroups: restDuplicateGroups.filter((g) => g.count > 1),
  publishedLowPrecision,
  publishedInDuplicateGroups,
}

const outPath = path.join(root, "scripts/audit-coordinates-batch-report.json")
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8")
console.log("[audit-coordinates-batch] ->", outPath)
console.log(JSON.stringify(report.summary, null, 2))
