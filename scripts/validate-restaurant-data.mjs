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

function buildMapEndpoint(name, options = {}) {
  if (options.preferLatLng && isValidMapLatLng(options.latLng)) {
    return encodeURIComponent(`${options.latLng.lat},${options.latLng.lng}`)
  }
  return buildMapQuery(name, {
    mapQuery: options.mapQuery,
    address: options.address,
  })
}

function hallEmbedUrl(hall) {
  const q = buildMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
    preferLatLng: isValidMapLatLng(hall),
  })
  return `https://maps.google.com/maps?q=${q}&output=embed&z=17`
}

function hallPlaceUrl(hall) {
  const query = buildMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
    preferLatLng: isValidMapLatLng(hall),
  })
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function routeEmbedUrl(hall, restaurant) {
  const origin = buildMapEndpoint(hall.name, {
    latLng: { lat: hall.lat, lng: hall.lng },
    address: hall.address,
    preferLatLng: isValidMapLatLng(hall),
  })
  const destination = buildMapEndpoint(restaurant.name, {
    latLng: { lat: restaurant.lat, lng: restaurant.lng },
    address: restaurant.address,
    preferLatLng: isValidMapLatLng(restaurant),
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
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
let warnings = 0
const hallCounts = {}
const zeroRestaurantHalls = []
const hallMapWarnings = {
  mapQueryMismatch: [],
  nameOnlyMapQuery: [],
  lowPrecisionCoords: [],
  nameOnlyFallback: [],
}

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

    const mapQueryField = getHallMapQueryField(hall)
    if (mapQueryField) {
      const expectedQuery = `${hall.name} ${hall.address}`.trim()
      if (mapQueryField.trim() !== expectedQuery) {
        console.warn(
          `[warn] ${hall.id}: map_query differs from name+address (map_query="${mapQueryField}")`,
        )
        hallMapWarnings.mapQueryMismatch.push(hall.id)
        warnings++
      }
      if (isNameOnlyMapQuery(mapQueryField, hall.name)) {
        console.warn(
          `[warn] ${hall.id}: map_query is name-only ("${mapQueryField}")`,
        )
        hallMapWarnings.nameOnlyMapQuery.push(hall.id)
        warnings++
      }
    }

    const hasCoords = isValidMapLatLng(hall)
    if (!hasCoords) {
      console.warn(
        `[warn] ${hall.id}: missing or invalid lat/lng — map URLs fall back to name+address`,
      )
      hallMapWarnings.nameOnlyFallback.push(hall.id)
      warnings++
    } else if (isLowPrecision(hall.lat, hall.lng)) {
      console.warn(
        `[warn] ${hall.id}: low-precision coordinates (${hall.lat}, ${hall.lng})`,
      )
      hallMapWarnings.lowPrecisionCoords.push(hall.id)
      warnings++
    }

    const embedUrl = hallEmbedUrl(hall)
    const placeUrl = hallPlaceUrl(hall)
    if (hasCoords) {
      const expectedCoord = encodeURIComponent(`${hall.lat},${hall.lng}`)
      if (!embedUrl.includes(`q=${expectedCoord}`)) {
        console.error(
          `[ERROR] ${hall.id}: hall embed URL does not use coordinates (${embedUrl})`,
        )
        errors++
      }
      if (!placeUrl.includes(`query=${expectedCoord}`)) {
        console.error(
          `[ERROR] ${hall.id}: hall place URL does not use coordinates (${placeUrl})`,
        )
        errors++
      }
    } else {
      const expectedNameAddress = buildMapQuery(hall.name, { address: hall.address })
      if (!embedUrl.includes(`q=${expectedNameAddress}`)) {
        console.error(
          `[ERROR] ${hall.id}: hall embed URL does not use name+address fallback`,
        )
        errors++
      }
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
      const expectedOrigin = encodeURIComponent(`${hall.lat},${hall.lng}`)
      const expectedDest = encodeURIComponent(`${r.lat},${r.lng}`)
      if (!url.includes(`saddr=${expectedOrigin}`)) {
        console.error(
          `[ERROR] ${hall.id} ↔ ${r.id}: route URL saddr does not use hall coordinates (${url})`,
        )
        errors++
      }
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
      hallMapWarnings,
      warningCount: warnings,
    },
    null,
    2,
  ),
)
