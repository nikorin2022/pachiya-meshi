/**
 * 梅田エリア飲食店データの再構築（監査済み・実在確認店舗のみ）
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const restaurantsPath = path.join(
  root,
  "data/prefectures/osaka/restaurants.json",
)

const REMOVE_IDS = new Set([
  "mutekiro-umeda",
  "ramen-waizu-umeda",
  "stout-umeda",
  "konamon-umeda",
  "ramen-zundoya-umeda",
])

/** 座標・住所は公式店舗ページ / NAVITIME / MapFan / 駅探で照合済み */
const UMEDA_RESTAURANTS = [
  {
    id: "ramen-zundoya-higashidori-umeda",
    legacy_id: 465,
    name: "ラー麺ずんどう屋 梅田東通り店",
    area_id: "umeda",
    genre: "ラーメン",
    time_category: ["昼", "夜"],
    hours: "24時間営業（メンテナンス休止あり）",
    tags: ["ガッツリ", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区堂山町2-10 K1ビル1F",
    lat: 34.702783,
    lng: 135.503488,
    default_ai_summary:
      "阪急東通りのずんどう屋。濃厚とんこつラーメンでガッツリ飯。深夜帯も稼働しやすい。",
  },
  {
    id: "ippudo-umeda",
    legacy_id: 466,
    name: "一風堂 梅田店",
    area_id: "umeda",
    genre: "ラーメン",
    time_category: ["昼", "夜"],
    hours: "11:00〜翌3:00",
    tags: ["ガッツリ", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区角田町6-7 角田町ビル1F",
    lat: 34.703454,
    lng: 135.5006,
    default_ai_summary:
      "角田町の一風堂。博多とんこつで勝った日のご褒美麺にも使いやすい定番。",
  },
  {
    id: "kamukura-hankyu-sanbangai",
    legacy_id: 467,
    name: "どうとんぼり神座 阪急三番街店",
    area_id: "umeda",
    genre: "ラーメン",
    time_category: ["昼", "夜"],
    hours: "10:00〜23:30",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区芝田1-1-3 阪急三番街南館1F",
    lat: 34.705203,
    lng: 135.498369,
    default_ai_summary:
      "阪急三番街の神座。提供が速く、梅田各駅からのアクセスも良いあっさり系ラーメン。",
  },
  {
    id: "tenkaippin-higashi-umeda",
    legacy_id: 468,
    name: "天下一品 東梅田店",
    area_id: "umeda",
    genre: "ラーメン",
    time_category: ["昼", "夜"],
    hours: "11:00〜翌3:30",
    tags: ["ガッツリ", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区野崎町9-12",
    lat: 34.702203,
    lng: 135.505982,
    default_ai_summary:
      "東梅田の天下一品。こってり系で軍資金を使い切った後のリセット飯にも向く。",
  },
  {
    id: "yoshinoya-ohatsu",
    legacy_id: 469,
    name: "吉野家 お初天神店",
    area_id: "umeda",
    genre: "丼もの",
    time_category: ["朝", "昼", "夜"],
    hours: "24時間営業",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区曾根崎2-5-20",
    lat: 34.699301,
    lng: 135.500812,
    default_ai_summary:
      "お初天神の24時間吉野家。曽根崎エリアのホールから戻りやすい牛丼定番。",
  },
  {
    id: "matsuya-kakudacho-umeda",
    legacy_id: 470,
    name: "松屋 梅田角田町店",
    area_id: "umeda",
    genre: "丼もの",
    time_category: ["朝", "昼", "夜"],
    hours: "24時間営業",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区角田町6-5",
    lat: 34.703487,
    lng: 135.50065,
    default_ai_summary:
      "角田町の24時間松屋。牛めしを素早く食べてホールへ戻れる梅田定番。",
  },
  {
    id: "nakau-umeda-higashi",
    legacy_id: 471,
    name: "なか卯 梅田東店",
    area_id: "umeda",
    genre: "丼もの",
    time_category: ["朝", "昼", "夜"],
    hours: "4:00〜翌3:00",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区鶴野町1-1 梅田セントラルビル",
    lat: 34.70601,
    lng: 135.501094,
    default_ai_summary:
      "梅田東のなか卯。親子丼やうどんを手軽に。早朝から深夜まで使える。",
  },
  {
    id: "sukiya-umeda-taiyuji",
    legacy_id: 472,
    name: "すき家 梅田太融寺店",
    area_id: "umeda",
    genre: "丼もの",
    time_category: ["朝", "昼", "夜"],
    hours: "4:00〜翌3:00",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address:
      "大阪府大阪市北区太融寺町5-8 ダイヤモンドレジャービル本館1F",
    lat: 34.702007,
    lng: 135.502938,
    default_ai_summary:
      "太融寺町のすき家。お初天神・東梅田方面のホールからサクッと牛丼。",
  },
  {
    id: "cocoichibanya-kita-kakudacho",
    legacy_id: 473,
    name: "カレーハウスCoCo壱番屋 北区角田町店",
    area_id: "umeda",
    genre: "カレー",
    time_category: ["昼", "夜"],
    hours: "11:00〜23:30",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区角田町1-20",
    lat: 34.704311,
    lng: 135.501368,
    default_ai_summary:
      "角田町のCoCo壱。トッピング自在のカレーで昼休憩に使いやすい。",
  },
  {
    id: "yayoi-umeda-higashi",
    legacy_id: 474,
    name: "やよい軒 梅田東店",
    area_id: "umeda",
    genre: "丼もの",
    time_category: ["朝", "昼", "夜"],
    hours: "4:00〜翌3:00",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区堂山町17-15 Axis Umeda.II.Bld.1F",
    lat: 34.704448,
    lng: 135.502415,
    default_ai_summary:
      "堂山町のやよい軒。定食でバランスよく食べられる梅田東の定番。",
  },
  {
    id: "matsunoya-umeda",
    legacy_id: 475,
    name: "松のや 梅田店",
    area_id: "umeda",
    genre: "とんかつ/カツ丼",
    time_category: ["昼", "夜"],
    hours: "10:00〜22:00",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区角田町6-3 北大阪角田町ビル1F",
    lat: 34.703591,
    lng: 135.500669,
    default_ai_summary:
      "角田町の松のや。とんかつ・かつ丼を手軽に。梅田駅前圏の定番チェーン。",
  },
  {
    id: "katsudon-yoshibei-higashi-umeda",
    legacy_id: 476,
    name: "かつ丼吉兵衛 東梅田店",
    area_id: "umeda",
    genre: "とんかつ/カツ丼",
    time_category: ["昼", "夜"],
    hours: "11:00〜22:00",
    tags: ["ガッツリ", "一人OK"],
    address: "大阪府大阪市北区堂山町18-2",
    lat: 34.704759,
    lng: 135.502329,
    default_ai_summary:
      "堂山町の吉兵衛。玉子とじかつ丼が名物。地場チェーンのかつ丼専門店。",
  },
  {
    id: "sushiro-ohatsu",
    legacy_id: 477,
    name: "スシロー お初天神通り店",
    area_id: "umeda",
    genre: "回転寿司",
    time_category: ["昼", "夜"],
    hours: "11:00〜23:00",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区曽根崎2-15-20 SWINGうめだ5階",
    lat: 34.701771,
    lng: 135.500839,
    default_ai_summary:
      "お初天神通りのスシロー。回転寿司でサクッと飯。曽根崎ホール圏に便利。",
  },
  {
    id: "kurasushi-umeda-os",
    legacy_id: 478,
    name: "くら寿司 梅田OSビル店",
    area_id: "umeda",
    genre: "回転寿司",
    time_category: ["昼", "夜"],
    hours: "11:00〜24:00",
    tags: ["サク飯", "一人OK", "深夜OK"],
    address: "大阪府大阪市北区小松原町3-3 OSビルB1F",
    lat: 34.702806,
    lng: 135.500364,
    default_ai_summary:
      "阪急東通入口付近のくら寿司。回転寿司で手軽に締めまで組み立てやすい。",
  },
  {
    id: "marugame-umeda",
    legacy_id: 479,
    name: "丸亀製麺梅田",
    area_id: "umeda",
    genre: "そば/うどん",
    time_category: ["昼", "夜"],
    hours: "10:00〜23:00",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区角田町6-3 北大阪角田町ビル1F",
    lat: 34.703544,
    lng: 135.500709,
    default_ai_summary:
      "角田町の丸亀製麺。讃岐うどんを素早く。梅田駅前の定番サク飯。",
  },
  {
    id: "mcdonalds-shin-umeda",
    legacy_id: 480,
    name: "マクドナルド 新梅田店",
    area_id: "umeda",
    genre: "ハンバーガー",
    time_category: ["朝", "昼", "夜"],
    hours: "5:45〜23:30",
    tags: ["サク飯", "一人OK"],
    address: "大阪府大阪市北区角田町9-29 新梅田食道街",
    lat: 34.703857,
    lng: 135.498197,
    default_ai_summary:
      "新梅田食道街のマクドナルド。朝マックから夜まで使える駅前定番。",
  },
  {
    id: "gyukaku-umeda-hankyu-higashidori",
    legacy_id: 481,
    name: "牛角 梅田阪急東通り店",
    area_id: "umeda",
    genre: "焼肉",
    time_category: ["昼", "夜"],
    hours: "12:00〜24:00",
    tags: ["ガッツリ", "一人OK"],
    address: "大阪府大阪市北区小松原町1-16 梅田モコビル1F",
    lat: 34.70243,
    lng: 135.500759,
    default_ai_summary:
      "阪急東通の牛角。焼肉でガッツリ飯。勝った日のご褒美飯にも使える。",
  },
]

const restaurants = JSON.parse(fs.readFileSync(restaurantsPath, "utf8"))
const kept = restaurants.filter((r) => !REMOVE_IDS.has(r.id))
const merged = [...kept, ...UMEDA_RESTAURANTS]

fs.writeFileSync(restaurantsPath, JSON.stringify(merged, null, 2) + "\n")
console.log(
  `Removed ${REMOVE_IDS.size} legacy umeda entries, added ${UMEDA_RESTAURANTS.length} verified entries.`,
)
