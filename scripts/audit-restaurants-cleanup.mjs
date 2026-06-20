/**
 * 飲食店データ信頼性監査・クリーンアップ
 * シードスクリプトで生成された座標未検証の店舗を削除する。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MAX_STRAIGHT_M = 800

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

/** 実在が確認できる店舗 ID（削除しない） */
const KEEP_IDS = new Set([
  // aichi - 名古屋の有名店
  "yabaton-sakae-honten",
  "misen-yabacho-sakae",
  "yamamotoya-sakae",
  "yabaton-meieki",
  // miyagi
  "gyutan-kaku-sendai-higashi",
  "gyutan-rikyu-sendai",
  // hokkaido
  "ramen-shingen-sapporo",
  "ramen-sumire-tanukikoji",
  "soupcurry-garaku-sapporo",
  // osaka umeda seeded (有名店のみ)
  "stout-umeda",
  "konamon-umeda",
  "ramen-zundoya-umeda",
  "mutekiro-umeda",
  "ramen-waizu-umeda",
  // osaka nanba extra
  "dotonbori-kukuru-nanba",
  "sukiya-nanba-sennichimae",
  // fukuoka
  "hakata-ippudo-honten",
  "hakata-menguide",
  "hakata-ichiran",
  "hakata-soupcurry",
  "hakata-udon",
  "hakata-udon-tsubame",
  "tenjin-ippudo",
])

/** 存在不明の汎用店名（ブランド名なし） */
function isFabricatedName(name) {
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

/** 座標未検証のチェーン支店（シード由来） */
function isUnverifiedChainBranch(name) {
  const patterns = [
    /^一蘭\s/,
    /^一風堂\s+(?!博多本店)/,
    /^神座\s+梅田店$/,
    /^かつや\s/,
    /^とんかつ和幸\s/,
    /^天丼てんや\s/,
    /^くら寿司\s/,
    /^スシロー\s/,
    /^杵屋\s/,
    /^なだい富士そば\s/,
    /^焼肉ライク\s/,
    /^カレーハウスCoCo壱番屋\s/,
    /^なか卯\s/,
    /^モスバーガー\s/,
    /^マクドナルド\s/,
    /^吉野家\s/,
    /^すき家\s/,
    /^松屋\s/,
    /^はま寿司\s/,
    /^焼肉\s+牛庵\s+(?!本店)/,
    /^サガミ\s/,
    /^スープカレー\s+ジャングル/,
    /^らーめん\s+わいず/,
  ]
  return patterns.some((re) => re.test(name))
}

const OSAKA_ORIGINAL_MAX_LEGACY = 427

const report = {
  deleted: [],
  distanceDeleted: [],
  fabricatedDeleted: [],
  unverifiedDeleted: [],
  seededDeleted: [],
  hallCounts: {},
}

const prefs = ["aichi", "miyagi", "hokkaido", "osaka", "fukuoka"]

for (const pref of prefs) {
  const hallsPath = path.join(root, "data/prefectures", pref, "halls.json")
  const restPath = path.join(root, "data/prefectures", pref, "restaurants.json")
  const halls = JSON.parse(fs.readFileSync(hallsPath, "utf8"))
  const restaurants = JSON.parse(fs.readFileSync(restPath, "utf8"))

  const kept = []
  for (const r of restaurants) {
    if (KEEP_IDS.has(r.id)) {
      kept.push(r)
      continue
    }

    const areaHalls = halls.filter((h) => h.area_id === r.area_id)
    if (areaHalls.length === 0) {
      report.deleted.push({ pref, id: r.id, name: r.name, reason: "no_area" })
      continue
    }

    const minDist = Math.min(...areaHalls.map((h) => haversineM(h, r)))
    if (minDist > MAX_STRAIGHT_M) {
      report.distanceDeleted.push({
        pref,
        id: r.id,
        name: r.name,
        dist: Math.round(minDist),
      })
      continue
    }

    // osaka: legacy_id <= 427 は手動調査済みの難波エリア店舗
    if (
      pref === "osaka" &&
      r.legacy_id != null &&
      r.legacy_id <= OSAKA_ORIGINAL_MAX_LEGACY
    ) {
      if (isFabricatedName(r.name)) {
        report.fabricatedDeleted.push({ pref, id: r.id, name: r.name })
        continue
      }
      kept.push(r)
      continue
    }

    // osaka seeded umeda/nanba-extra: 有名店以外は削除
    if (pref === "osaka") {
      report.seededDeleted.push({ pref, id: r.id, name: r.name })
      continue
    }

    if (isFabricatedName(r.name)) {
      report.fabricatedDeleted.push({ pref, id: r.id, name: r.name })
      continue
    }

    if (isUnverifiedChainBranch(r.name)) {
      report.unverifiedDeleted.push({ pref, id: r.id, name: r.name })
      continue
    }

    kept.push(r)
  }

  fs.writeFileSync(restPath, JSON.stringify(kept, null, 2) + "\n", "utf8")

  for (const hall of halls) {
    let count = 0
    const areaRest = kept.filter((r) => r.area_id === hall.area_id)
    for (const r of areaRest) {
      if (walkMinutes(hall, r) <= 10) count++
    }
    report.hallCounts[hall.id] = count
  }
}

const summary = {
  fabricated: report.fabricatedDeleted.length,
  unverified: report.unverifiedDeleted.length,
  seeded: report.seededDeleted.length,
  distance: report.distanceDeleted.length,
  totalDeleted:
    report.fabricatedDeleted.length +
    report.unverifiedDeleted.length +
    report.seededDeleted.length +
    report.distanceDeleted.length,
  hallCounts: report.hallCounts,
  hallsUnder5: Object.entries(report.hallCounts).filter(([, c]) => c < 5),
  keptPerPref: prefs.map((p) => ({
    pref: p,
    count: JSON.parse(
      fs.readFileSync(
        path.join(root, "data/prefectures", p, "restaurants.json"),
        "utf8",
      ),
    ).length,
  })),
}

fs.writeFileSync(
  path.join(root, "scripts/audit-restaurants-report.json"),
  JSON.stringify({ summary, report }, null, 2),
)
console.log(JSON.stringify(summary, null, 2))
