/**
 * 飲食店データ品質監査 Phase1: 架空店舗・不存在支店・閉店店舗の削除と
 * 確認済み店舗の名称・住所・座標修正。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** 実在確認できず削除（架空・不存在支店・閉店） */
const REMOVE_IDS = new Set([
  // 難波: seed由来・汎用名・不存在支店
  "horumon-sennichimae",
  "gyuta-nanba-honten",
  "ramendokoro-nanba",
  "soupcurry-kamui-nanba",
  "misen-nanba",
  "gyuan-nanba",
  // 博多: 不存在支店・別地域チェーン
  "hakata-udon",
  "hakata-soupcurry",
  "hakata-udon-tsubame",
  // 札幌: 不存在支店
  "ramen-shingen-sapporo",
  "ramen-sumire-tanukikoji",
  // 仙台: 不存在店舗名
  "gyutan-kaku-sendai-higashi",
])

/** 公式サイト・店舗案内で確認済みの修正 */
const FIXES = {
  "gyutan-rikyu-sendai": {
    name: "牛たん炭焼 利久 仙台駅店",
    address: "宮城県仙台市青葉区中央1-1-1 仙台駅3F牛たん通り",
    lat: 38.260139,
    lng: 140.8825,
    hours: "10:00〜21:30（LO21:00）",
    default_ai_summary:
      "仙台駅3F牛たん通りの利久。駅構内で本場の牛タン定食を手軽に味わえる定番。",
  },
  "soupcurry-garaku-sapporo": {
    name: "Soup Curry GARAKU sitatte sapporo店",
    address: "北海道札幌市中央区北2条西3-1-20 札幌フコク生命越山ビル B1F",
    lat: 43.062783,
    lng: 141.350278,
    hours: "11:30〜15:30（LO15:00）/ 17:00〜21:00（LO20:30）",
    default_ai_summary:
      "sitatte sapporoの人気スープカレーGARAKU。チカホ直結で札幌駅エリアからアクセスしやすい。",
  },
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

function saveJson(p, data) {
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

const prefectures = ["osaka", "fukuoka", "miyagi", "hokkaido"]
let removed = 0
let fixed = 0

for (const pref of prefectures) {
  const restaurantsPath = path.join(
    root,
    "data/prefectures",
    pref,
    "restaurants.json",
  )
  const restaurants = loadJson(restaurantsPath)
  const next = []

  for (const r of restaurants) {
    if (REMOVE_IDS.has(r.id)) {
      console.log(`[remove] ${pref} ${r.id} (${r.name})`)
      removed++
      continue
    }

    const patch = FIXES[r.id]
    if (patch) {
      Object.assign(r, patch)
      console.log(`[fix] ${pref} ${r.id} -> ${r.name}`)
      fixed++
    }
    next.push(r)
  }

  saveJson(restaurantsPath, next)
}

console.log(`\nPhase1 audit apply: removed=${removed}, fixed=${fixed}`)
