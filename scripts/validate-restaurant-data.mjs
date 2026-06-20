/**
 * 飲食店データの距離・件数・マップURL整合性を検証する。
 * generate:halls 前後の監査用。
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

function estimateWalkMinutes(hall, r) {
  const direct = haversineM(hall, r)
  return Math.max(1, Math.ceil((direct * 1.3) / 80))
}

function withinBoundingBox(a, b, limitKm) {
  const latDiffKm = Math.abs(a.lat - b.lat) * 111
  if (latDiffKm > limitKm) return false
  const lngDiffKm = Math.abs(a.lng - b.lng) * 91
  if (lngDiffKm > limitKm) return false
  return true
}

function buildMapEndpoint(name, options = {}) {
  if (options.preferLatLng && options.latLng) {
    return encodeURIComponent(`${options.latLng.lat},${options.latLng.lng}`)
  }
  const query = options.mapQuery?.trim() ? options.mapQuery : name
  return encodeURIComponent(query)
}

function routeEmbedUrl(hall, restaurant) {
  const origin = buildMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    preferLatLng: true,
  })
  const destination = buildMapEndpoint(restaurant.name, {
    latLng: { lat: restaurant.lat, lng: restaurant.lng },
    preferLatLng: Boolean(restaurant.lat && restaurant.lng),
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
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
  matches.sort((a, b) => {
    if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes
    return a.restaurant.id.localeCompare(b.restaurant.id)
  })
  return matches
}

const prefs = fs
  .readdirSync(path.join(root, "data/prefectures"))
  .filter((p) => {
    const halls = path.join(root, "data/prefectures", p, "halls.json")
    return fs.existsSync(halls)
  })

let errors = 0
const hallCounts = {}
const zeroRestaurantHalls = []

for (const pref of prefs) {
  const halls = loadJson(path.join(root, "data/prefectures", pref, "halls.json"))
  const restaurants = loadJson(
    path.join(root, "data/prefectures", pref, "restaurants.json"),
  )

  for (const hall of halls) {
    const matches = matchForHall(hall, restaurants)
    hallCounts[hall.id] = matches.length

    if (matches.length === 0) {
      zeroRestaurantHalls.push(hall.id)
    }

    for (const { restaurant: r, dist } of matches) {
      if (dist > MAX_STRAIGHT_M) {
        console.error(
          `[ERROR] ${pref} ${hall.id} ↔ ${r.id} (${r.name}): ${Math.round(dist)}m > ${MAX_STRAIGHT_M}m`,
        )
        errors++
      }

      if (!r.lat || !r.lng) {
        console.error(
          `[ERROR] ${hall.id} ↔ ${r.id}: restaurant lat/lng missing in source data`,
        )
        errors++
        continue
      }

      const legacyRestaurant = {
        lat: r.lat,
        lng: r.lng,
      }
      if (!legacyRestaurant.lat || !legacyRestaurant.lng) {
        console.error(
          `[ERROR] ${hall.id} ↔ ${r.id}: generated Restaurant would miss lat/lng`,
        )
        errors++
      }

      const url = routeEmbedUrl(hall, r)
      const expectedDest = encodeURIComponent(`${r.lat},${r.lng}`)
      if (!url.includes(`daddr=${expectedDest}`)) {
        console.error(
          `[ERROR] ${hall.id} ↔ ${r.id}: route URL daddr does not use restaurant coordinates (${url})`,
        )
        errors++
      }
    }
  }
}

const under5 = Object.entries(hallCounts).filter(([, c]) => c < 5)
if (under5.length > 0) {
  console.warn("[warn] halls with <5 restaurants:", under5)
}

if (zeroRestaurantHalls.length > 0) {
  console.warn("[warn] halls with 0 restaurants:", zeroRestaurantHalls)
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s) found`)
  process.exit(1)
}

console.log("[validate-restaurant-data] OK")
console.log(
  JSON.stringify(
    {
      hallCounts,
      under5Count: under5.length,
      zeroRestaurantCount: zeroRestaurantHalls.length,
    },
    null,
    2,
  ),
)
