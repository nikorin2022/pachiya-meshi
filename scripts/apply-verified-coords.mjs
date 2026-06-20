import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")

const hallUpdates = [
  {
    file: "data/prefectures/osaka/halls.json",
    id: "maruhan-nanba-honten",
    lat: 34.665828,
    lng: 135.503011,
  },
  {
    file: "data/prefectures/osaka/halls.json",
    id: "maruhan-nanba-shinkan",
    lat: 34.666071,
    lng: 135.502534,
  },
  {
    file: "data/prefectures/osaka/halls.json",
    id: "rakuen-nanba",
    lat: 34.6651173,
    lng: 135.502652,
  },
  {
    file: "data/prefectures/osaka/halls.json",
    id: "123-nanba",
    lat: 34.666289,
    lng: 135.503486,
    address: "大阪府大阪市中央区千日前2-8-4",
    access: "なんば駅・日本橋駅より徒歩2分 / 千日前商店街・アムザ1000ビル内",
  },
  {
    file: "data/prefectures/miyagi/halls.json",
    id: "ams-garden-sendai-ekimae",
    lat: 38.262033,
    lng: 140.87945,
  },
  {
    file: "data/prefectures/miyagi/halls.json",
    id: "vegas-vegas-nakakecho",
    lat: 38.262163,
    lng: 140.879664,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "plaza-hakata",
    lat: 33.589651,
    lng: 130.421955,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "123-hakata",
    lat: 33.5869721,
    lng: 130.4127017,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "zion-hakata-ekimae",
    lat: 33.593674,
    lng: 130.414274,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "gogo-arena-tenjin",
    lat: 33.589705,
    lng: 130.39754,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "plaza-tenjin",
    lat: 33.58984,
    lng: 130.397704,
  },
  {
    file: "data/prefectures/fukuoka/halls.json",
    id: "boom-tenjin-honten",
    lat: 33.5863166,
    lng: 130.4004244,
  },
]

const restaurantUpdates = [
  {
    file: "data/prefectures/tokyo/restaurants.json",
    id: "katsuya-shibuya-dogenzaka",
    lat: 35.658803,
    lng: 139.698231,
  },
  {
    file: "data/prefectures/tokyo/restaurants.json",
    id: "komoro-soba-shinbashi",
    lat: 35.666424,
    lng: 139.757451,
  },
  {
    file: "data/prefectures/tokyo/restaurants.json",
    id: "katsuya-shinbashi",
    lat: 35.6667139,
    lng: 139.7572771,
  },
  {
    file: "data/prefectures/tokyo/restaurants.json",
    id: "matsuya-tachikawa-shibasakicho",
    lat: 35.6878284,
    lng: 139.4077096,
  },
  {
    file: "data/prefectures/tokyo/restaurants.json",
    id: "matsunoya-tachikawa-shibasakicho",
    lat: 35.6878284,
    lng: 139.4077096,
  },
]

function applyUpdates(filePath, updates, label) {
  const abs = path.join(root, filePath)
  const items = JSON.parse(fs.readFileSync(abs, "utf8"))
  const applied = []

  for (const update of updates) {
    const item = items.find((entry) => entry.id === update.id)
    if (!item) {
      console.warn(`[skip] ${label} not found: ${update.id}`)
      continue
    }
    const before = { lat: item.lat, lng: item.lng, address: item.address }
    item.lat = update.lat
    item.lng = update.lng
    if (update.address) item.address = update.address
    if (update.access) item.access = update.access
    applied.push({ id: update.id, before, after: { lat: item.lat, lng: item.lng, address: item.address } })
  }

  fs.writeFileSync(abs, `${JSON.stringify(items, null, 2)}\n`, "utf8")
  return applied
}

const hallApplied = []
for (const [file, group] of Object.entries(
  Object.groupBy(hallUpdates, (u) => u.file),
)) {
  hallApplied.push(...applyUpdates(file, group, "hall"))
}

const restaurantApplied = applyUpdates(
  "data/prefectures/tokyo/restaurants.json",
  restaurantUpdates,
  "restaurant",
)

console.log(JSON.stringify({ halls: hallApplied, restaurants: restaurantApplied }, null, 2))
