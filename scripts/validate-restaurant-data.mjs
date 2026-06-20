/**
 * 飲食店データの距離・件数を検証する。
 * generate:halls 前後の監査用。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MAX_STRAIGHT_M = 800
const MAX_WALK_MINUTES = 10

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

function walkMinutes(hall, r) {
  const direct = haversineM(hall, r)
  return Math.max(1, Math.ceil((direct * 1.3) / 80))
}

const prefs = fs
  .readdirSync(path.join(root, "data/prefectures"))
  .filter((p) => {
    const halls = path.join(root, "data/prefectures", p, "halls.json")
    return fs.existsSync(halls)
  })

let errors = 0
const hallCounts = {}

for (const pref of prefs) {
  const halls = JSON.parse(
    fs.readFileSync(path.join(root, "data/prefectures", pref, "halls.json"), "utf8"),
  )
  const restaurants = JSON.parse(
    fs.readFileSync(
      path.join(root, "data/prefectures", pref, "restaurants.json"),
      "utf8",
    ),
  )

  for (const hall of halls) {
    let count = 0
    for (const r of restaurants.filter((x) => x.area_id === hall.area_id)) {
      const dist = haversineM(hall, r)
      const wm = walkMinutes(hall, r)
      if (wm <= MAX_WALK_MINUTES) {
        count++
        if (dist > MAX_STRAIGHT_M) {
          console.error(
            `[ERROR] ${pref} ${hall.id} ↔ ${r.id} (${r.name}): ${Math.round(dist)}m > ${MAX_STRAIGHT_M}m`,
          )
          errors++
        }
      }
    }
    hallCounts[hall.id] = count
  }
}

const under5 = Object.entries(hallCounts).filter(([, c]) => c < 5)
if (under5.length > 0) {
  console.warn("[warn] halls with <5 restaurants:", under5)
}

if (errors > 0) {
  console.error(`\n${errors} distance violation(s) found`)
  process.exit(1)
}

console.log("[validate-restaurant-data] OK")
console.log(JSON.stringify({ hallCounts, under5Count: under5.length }, null, 2))
