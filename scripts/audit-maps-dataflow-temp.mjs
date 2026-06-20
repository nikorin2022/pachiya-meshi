/**
 * 一時調査スクリプト（データフロー監査・修正なし）
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const {
  generateMapEmbedUrl,
  getGoogleMapsPlaceUrl,
  getGoogleMapsDirectionUrl,
  generateRouteEmbedUrl,
  isValidMapLatLng,
} = await import(pathToFileURL(path.join(root, "lib/maps.ts")).href)

const { getHallById } = await import(
  pathToFileURL(path.join(root, "lib/halls/index.ts")).href
)

const TARGET = [
  "shikairi-umeda",
  "maruhan-nanba-honten",
  "plaza-hakata",
  "p-station-slot-sendai",
  "himawari-sapporo-ekimae-tower",
]

const PREF_MAP = {
  "shikairi-umeda": "osaka",
  "maruhan-nanba-honten": "osaka",
  "plaza-hakata": "fukuoka",
  "p-station-slot-sendai": "miyagi",
  "himawari-sapporo-ekimae-tower": "hokkaido",
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

function decodeEndpoint(encoded) {
  if (!encoded) return null
  const raw = decodeURIComponent(encoded)
  const m = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)
  if (m) return { type: "coords", lat: Number(m[1]), lng: Number(m[2]), raw }
  return { type: "text", raw }
}

function parseMapsUrl(url) {
  const u = new URL(url)
  const out = { url }
  out.query = u.searchParams.get("query")
  out.origin = u.searchParams.get("origin")
  out.destination = u.searchParams.get("destination")
  out.q = u.searchParams.get("q")
  out.saddr = u.searchParams.get("saddr")
  out.daddr = u.searchParams.get("daddr")
  if (out.query) out.queryDecoded = decodeEndpoint(out.query)
  if (out.origin) out.originDecoded = decodeEndpoint(out.origin)
  if (out.destination) out.destinationDecoded = decodeEndpoint(out.destination)
  if (out.q) out.qDecoded = decodeEndpoint(out.q)
  if (out.saddr) out.saddrDecoded = decodeEndpoint(out.saddr)
  if (out.daddr) out.daddrDecoded = decodeEndpoint(out.daddr)
  return out
}

function pickHallJson(pref, id) {
  const halls = loadJson(path.join(root, "data/prefectures", pref, "halls.json"))
  return halls.find((h) => h.id === id)
}

function restaurantSlugIndex(pref) {
  const rs = loadJson(
    path.join(root, "data/prefectures", pref, "restaurants.json"),
  )
  const byLegacy = new Map()
  for (const r of rs) byLegacy.set(r.legacy_id ?? r.id, r)
  return { list: rs, byLegacy }
}

function haversineM(a, b) {
  const R = 6371008.8
  const t = (d) => (d * Math.PI) / 180
  const dLat = t(b.lat - a.lat)
  const dLng = t(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const report = {}

for (const hallId of TARGET) {
  const pref = PREF_MAP[hallId]
  const srcHall = pickHallJson(pref, hallId)
  const genHall = getHallById(hallId)
  const { byLegacy } = restaurantSlugIndex(pref)

  const hallBlock = {
    source_halls_json: srcHall
      ? {
          id: srcHall.id,
          name: srcHall.name,
          address: srcHall.address,
          lat: srcHall.lat,
          lng: srcHall.lng,
        }
      : null,
    generated: genHall
      ? {
          id: genHall.id,
          name: genHall.name,
          address: genHall.address,
          lat: genHall.lat,
          lng: genHall.lng,
        }
      : null,
    source_vs_generated: {
      address_match: srcHall?.address === genHall?.address,
      lat_match: srcHall?.lat === genHall?.lat,
      lng_match: srcHall?.lng === genHall?.lng,
      lat_lng_missing_in_generated:
        genHall
          ? !Number.isFinite(genHall.lat) || !Number.isFinite(genHall.lng)
          : null,
    },
    hallDetailClient_inputs: genHall
      ? {
          display_address: genHall.address,
          embed: {
            name: genHall.name,
            address: genHall.address,
            latLng: { lat: genHall.lat, lng: genHall.lng },
            isValidLatLng: isValidMapLatLng({
              lat: genHall.lat,
              lng: genHall.lng,
            }),
          },
          placeUrl_inputs: {
            name: genHall.name,
            latLng: { lat: genHall.lat, lng: genHall.lng },
            address: genHall.address,
          },
        }
      : null,
    urls: genHall
      ? {
          embed: generateMapEmbedUrl(genHall.name, undefined, {
            latLng: { lat: genHall.lat, lng: genHall.lng },
            address: genHall.address,
          }),
          place: getGoogleMapsPlaceUrl(genHall.name, {
            latLng: { lat: genHall.lat, lng: genHall.lng },
            address: genHall.address,
          }),
        }
      : null,
    url_parse: genHall
      ? {
          embed: parseMapsUrl(
            generateMapEmbedUrl(genHall.name, undefined, {
              latLng: { lat: genHall.lat, lng: genHall.lng },
              address: genHall.address,
            }),
          ),
          place: parseMapsUrl(
            getGoogleMapsPlaceUrl(genHall.name, {
              latLng: { lat: genHall.lat, lng: genHall.lng },
              address: genHall.address,
            }),
          ),
        }
      : null,
    restaurants: [],
  }

  if (genHall) {
    for (const r of genHall.restaurants.slice(0, 3)) {
      const srcR = byLegacy.get(r.id)
      const straightM = Math.round(haversineM(genHall, r))
      const routeEmbed = generateRouteEmbedUrl(genHall.name, r.name, {
        originLatLng: { lat: genHall.lat, lng: genHall.lng },
        originAddress: genHall.address,
        destinationLatLng: { lat: r.lat, lng: r.lng },
        destinationAddress: r.address,
      })
      const direction = getGoogleMapsDirectionUrl(genHall.name, r.name, {
        originLatLng: { lat: genHall.lat, lng: genHall.lng },
        originAddress: genHall.address,
        destinationLatLng: { lat: r.lat, lng: r.lng },
        destinationAddress: r.address,
      })
      hallBlock.restaurants.push({
        generated_legacy_id: r.id,
        source_restaurants_json: srcR
          ? {
              id: srcR.id,
              name: srcR.name,
              address: srcR.address,
              lat: srcR.lat,
              lng: srcR.lng,
            }
          : "NOT_FOUND_BY_LEGACY_ID",
        generated_restaurant: {
          id: r.id,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
        },
        source_vs_generated: srcR
          ? {
              name_match: srcR.name === r.name,
              address_match: srcR.address === r.address,
              lat_match: srcR.lat === r.lat,
              lng_match: srcR.lng === r.lng,
            }
          : null,
        hallDetailClient_inputs: {
          originLatLng: { lat: genHall.lat, lng: genHall.lng },
          originAddress: genHall.address,
          destinationLatLng: { lat: r.lat, lng: r.lng },
          destinationAddress: r.address,
          destIsValidLatLng: isValidMapLatLng({ lat: r.lat, lng: r.lng }),
        },
        straight_distance_m: straightM,
        urls: { routeEmbed, direction },
        url_parse: {
          routeEmbed: parseMapsUrl(routeEmbed),
          direction: parseMapsUrl(direction),
        },
      })
    }
  }

  report[hallId] = hallBlock
}

console.log(JSON.stringify(report, null, 2))
