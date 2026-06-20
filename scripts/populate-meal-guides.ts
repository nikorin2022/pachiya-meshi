/**
 * data/prefectures/<pref>/halls.json の全ホールに meal_guide を一括生成する。
 * 既存 meal_guide は上書きする。
 *
 * 運用:
 *   - generate:halls には含めない（手動実行専用）
 *   - 新規県追加時や meal_guide 一括更新時に使う
 *   - 実行後は必ず `npm run generate:halls` で _generated を再生成する
 *
 * 使い方:
 *   npm run populate:meal-guides
 *   npm run populate:meal-guides -- osaka
 *   （data/prefectures/<pref>/halls.json を対象にする。引数省略時は tokyo）
 */

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { FileDataSource } from "./sources/file-source"
import { MasterResolver } from "./lib/master-resolver"
import { RestaurantMatcher } from "./lib/restaurant-matcher"
import type { HallInput } from "./lib/schema"
import type { MatchedRestaurant } from "./lib/restaurant-matcher"

const GENRE_LABELS: Record<string, string> = {
  ラーメン: "ラーメン",
  カレー: "カレー",
  "とんかつ/カツ丼": "とんかつ・カツ丼",
  "そば/うどん": "そば・うどん",
  丼もの: "丼もの",
  回転寿司: "回転寿司",
  焼肉: "焼肉",
  ハンバーガー: "ハンバーガー",
}

const AREA_SCENE: Record<string, string> = {
  akihabara:
    "秋葉原は電気街のガード下飲食と駅前チェーンが混在し、短時間でも食事を組み立てやすい繁華街です。",
  shinjuku:
    "新宿は改札とホールの距離感がエリア内で大きく分かれ、歌舞伎町・西口・東南口ごとに飲食動線が変わります。",
  ikebukuro:
    "池袋は東口と西口で繁華街の顔が異なり、大型店と中規模店がそれぞれの改札側にまとまっています。",
  shibuya:
    "渋谷はハチ公口・西口・道玄坂で最短ルートが変わり、若者向けの回転の速い店が密集しています。",
  ueno:
    "上野はアメ横・御徒町・不忍口が近く、下町寄りの食堂と駅前チェーンを使い分けやすいエリアです。",
  kamata:
    "蒲田は東口・西口で商店街の雰囲気が変わり、駅前の牛丼・カレー・ラーメンが厚い郊外ターミナルです。",
  tachikawa:
    "立川は南口・北口のデッキ動線が発達し、モノレール各駅と合わせて飲食店へのアクセスが組み立てやすい拠点です。",
  machida:
    "町田はJRと小田急の北口・南口で動線が分かれ、郊外駅前らしいチェーン店と地場店が揃います。",
  kinshicho:
    "錦糸町は北口・南口で飲食激戦区が分かれ、ラーメンや牛丼、回転寿司など回転の速い店が多いエリアです。",
  kitasenju:
    "北千住は西口・東口でマルイや東武直結の動線があり、下町とターミナルの飲食が混在します。",
  shinbashi:
    "新橋は烏森口・銀座口のビジネス街飲食が中心で、立ち食いそばやカレーなどサク飯向け店が密集しています。",
  yurakucho:
    "有楽町はガード下飲食と駅ビル内チェーンが特徴で、銀座方面へ足を延ばす選択肢もあります。",
  gotanda:
    "五反田は駅前に大型ホールが集中し、東口・西口双方のラーメン・カレー店へ歩きやすい立地です。",
  takadanobaba:
    "高田馬場は学生街らしいリーズナブルなラーメン・カレー・丼ものが多く、短い休憩でも食事が組み立てやすいエリアです。",
  nakano:
    "中野は北口繁華街にラーメン・カレー・丼ものが密集し、サブカル寄りの店も混在するエリアです。",
  kichijoji:
    "吉祥寺は北口・南口でサンロードと公園口の動線が分かれ、カフェやハンバーガーなど幅広いジャンルが揃います。",
  akabane:
    "赤羽は東口・西口でエキュートと商店街の飲食が揃い、ターミナル駅前らしいチェーン店が厚いエリアです。",
  hachioji:
    "八王子は北口・京王口で駅前繁華街が広がり、郊外型の大型店周辺に回転の速い飲食店が多いエリアです。",
  kasai:
    "葛西は駅前商業施設とロードサイド型チェーンが揃い、家族連れにも一人稼働にも使いやすい飲食環境です。",
  koiwa:
    "小岩は北口駅前に牛丼・カレー・とんかつなど下町寄りのチェーンが密集するエリアです。",
  omori:
    "大森は東口・西口で駅前最大級の大型店が並び、ビジネス街と住宅街の飲食が混在します。",
  kanda:
    "神田は鍛冶町通りやオフィス街沿いに立ち食いそば・ラーメン・カレーが密集するサラリーマン飯エリアです。",
  okachimachi:
    "御徒町はアメ横と駅前が近く、丼もの・焼肉・回転寿司など選択肢の広いエリアです。",
  ayase:
    "綾瀬は西口・東口のロードサイドにチェーン店が揃い、住宅街寄りの落ち着いた飲食も選べます。",
  kameari:
    "亀有は北口・南口で駅前ロードサイドの飲食が厚く、下町の雰囲気の中でもチェーン店が充実しています。",
  "nishi-nippori":
    "西日暮里は日暮里・鶯谷圏の下町飲食を横断的に使え、ラーメンや立ち食いそばが多いエリアです。",
  chofu:
    "調布は本町通り沿いにラーメン・カレー・回転寿司が並び、府中競馬場方面への動線とも相性が良いエリアです。",
  fuchu:
    "府中は本町通りの飲食激戦区が南北口で共有され、とんかつや丼ものも選びやすいエリアです。",
  mitaka:
    "三鷹は吉祥寺に隣接する住宅街エリアで、駅前のカレー・ラーメン・牛丼が使いやすい立地です。",
  kokubunji:
    "国分寺は調布・府中とは別動線の駅前飲食があり、国領圏のチェーン店を起点に店を選びやすいエリアです。",
  "nakano-sakaue":
    "中野坂上はオフィス街と中野・新宿方面の中間に位置し、ランチ向けのカレー・丼ものが多いエリアです。",
  nanba:
    "難波・千日前は関西屈指のパチンコ・パチスロ密集地で、なんば駅・日本橋駅周辺の飲食店が徒歩圏にまとまっています。ラーメン、カレー、丼もの、焼肉、回転寿司などジャンルが豊富で、遠征ユーザーが多いエリアです。",
}

const ACCESS_HOOKS: Record<string, string> = {
  "island-akihabara": "電気街口から徒歩5分、末広町方面へも歩ける立地",
  "espace-akihabara-ekimae": "秋葉原駅電気街口の目の前という駅前立地",
  "vegas-vegas-shinjuku-higashiguchi": "新宿駅東南口から徒歩1分の改札直近",
  "maruhan-shinjuku-tobobiru": "西武新宿駅前・歌舞伎町入口から徒歩3分",
}

function hashId(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

function topGenres(matches: MatchedRestaurant[], limit = 4): string[] {
  const counts = new Map<string, number>()
  for (const m of matches) {
    counts.set(m.restaurant.genre, (counts.get(m.restaurant.genre) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([g]) => GENRE_LABELS[g] ?? g)
}

function hasTime(matches: MatchedRestaurant[], t: string): boolean {
  return matches.some((m) => m.restaurant.time_category.includes(t as "朝" | "昼" | "夜"))
}

function closesLate(hours: string): boolean {
  return /2[2-4]:|翌|24/.test(hours)
}

function shortenAccess(access: string): string {
  const first = access.split("/")[0].trim()
  return first.length > 48 ? first.slice(0, 47) + "…" : first
}

function buildGenreSentence(genres: string[]): string {
  if (genres.length === 0) return "周辺には徒歩圏内の飲食店がまとまっています。"
  const list = genres.join("、")
  return `徒歩10分圏内には${list}などが揃い、ジャンルを変えながら店を選べます。`
}

function buildTimeUses(hall: HallInput, matches: MatchedRestaurant[], seed: number): string {
  const parts: string[] = []
  if (hasTime(matches, "朝")) parts.push("朝一前の軽い食事")
  if (hasTime(matches, "昼")) parts.push("昼休憩のサクッと飯")
  if (hasTime(matches, "夜") || closesLate(hall.hours)) {
    parts.push("閉店後の夜飯や締めの一杯")
  }
  if (parts.length === 0) {
    return "稼働の合間に短時間で食事を挟める店が周辺に点在しています。"
  }
  const joined = parts.join("、")
  const templates = [
    `パチンコ・パチスロユーザーは${joined}など、休憩の長さに合わせて食事を組み立てやすいです。`,
    `${joined}といったシーンごとに候補店を変えやすく、稼働ペースを崩さず食事ができます。`,
    `朝一・昼・夜のどの時間帯でも${joined}を選びやすく、パチンコ・パチスロユーザーの遠征時の食事計画にも向きます。`,
  ]
  return templates[seed % templates.length]
}

function buildWalkNote(matches: MatchedRestaurant[], seed: number): string {
  if (matches.length >= 20) {
    const opts = [
      "掲載店が豊富で、同じホールでも日替わりで店を変えやすい点が強みです。",
      "徒歩圏の店数が多く、ジャンルと距離の組み合わせを細かく選べます。",
    ]
    return opts[seed % opts.length]
  }
  if (matches.length >= 10) {
    return "徒歩圏内の店舗を距離とジャンルで絞り込みやすく、遠征時の食事計画にも向きます。"
  }
  return "ホール周辺に飲食店がまとまっており、短い休憩でも往復しやすい動線です。"
}

function buildSlotNote(hall: HallInput, seed: number): string {
  if (hall.slot > hall.pachinko * 1.2) {
    const opts = [
      "スロット台数が厚く、遠征してくるパチンコ・パチスロユーザーが休憩動線を組み立てやすい立地です。",
      "パチスロ寄りの台構成で、パチンコ・パチスロユーザーが食事と稼働を往復しやすいホールです。",
    ]
    return opts[seed % opts.length]
  }
  if (hall.pachinko > hall.slot * 1.5) {
    const opts = [
      "パチンコ寄りの台構成で、長時間稼働の合間に近隣店へ足を延ばす使い方がしやすい立地です。",
      "パチンコ台が厚い店舗で、長めの休憩を取りながら周辺の飲食を使い分けやすいです。",
    ]
    return opts[seed % opts.length]
  }
  const opts = [
    "パチンコ・パチスロ双方の稼働者が、近隣飲食へ無理なく移動できる立地です。",
    "パチンコ・パチスロ双方の台数バランスがあり、休憩の使い方を柔軟に組み立てやすいです。",
  ]
  return opts[seed % opts.length]
}

function buildAccessLead(hall: HallInput, areaName: string): string {
  const hook = ACCESS_HOOKS[hall.id]
  if (hook) return hook
  const access = shortenAccess(hall.access)
  const leads = [
    `${access}に位置し`,
    `${access}というアクセスで`,
    `${areaName}エリアの${access}付近にあり`,
  ]
  return leads[hashId(hall.id) % leads.length]
}

function buildMealGuide(
  hall: HallInput,
  areaName: string,
  matches: MatchedRestaurant[],
): string {
  const seed = hashId(hall.id)
  const scene =
    AREA_SCENE[hall.area_id] ??
    `${areaName}エリアは駅周辺に飲食店がまとまり、ホールから徒歩圏内で食事先を探しやすい立地です。`
  const accessLead = buildAccessLead(hall, areaName)
  const genres = topGenres(matches)
  const genreSentence = buildGenreSentence(genres)
  const timeUses = buildTimeUses(hall, matches, seed)
  const slotNote = buildSlotNote(hall, seed)
  const walkNote = buildWalkNote(matches, seed)

  const variants = [
    `${areaName}で食事を考える際、${accessLead}、パチンコ・パチスロユーザーが食事と稼働を往復しやすいホールです。${scene}${genreSentence}${timeUses}${walkNote}`,
    `パチンコ・パチスロユーザー向けに見ると、${accessLead}、近隣飲食へのアクセスが大きな強みです。${scene}${genreSentence}${timeUses}ホールへ戻る距離も短く、休憩の長さに合わせて店を選びやすいです。${slotNote}`,
    `${hall.name}周辺は、${accessLead}、動線の起点として使いやすい立地です。${scene}${genreSentence}${timeUses}${slotNote}${walkNote}`,
  ]

  let text = variants[seed % variants.length]
  if (text.length < 180) {
    text +=
      "天候を気にせず徒歩圏で食事を済められるため、短い休憩でも無理なく稼働に戻れます。"
  }
  if (text.length > 500) {
    text = text.slice(0, 497) + "…"
  }
  return text
}

async function main() {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(scriptsDir, "..")
  const dataRoot = path.join(projectRoot, "data")
  const prefecture = process.argv[2] ?? "tokyo"
  const hallsPath = path.join(dataRoot, `prefectures/${prefecture}/halls.json`)

  const source = new FileDataSource(dataRoot)
  const [areas, chains, walkOverrides, exclusions, restaurants] =
    await Promise.all([
      source.loadAreas(),
      source.loadChains(),
      source.loadWalkMinutesOverrides(),
      source.loadExclusions(),
      source.loadRestaurants(prefecture),
    ])

  const hallsRaw = await fs.readFile(hallsPath, "utf8")
  const halls = JSON.parse(hallsRaw) as HallInput[]

  const masterResolver = MasterResolver.fromMasters(areas, chains)
  const matcher = new RestaurantMatcher(
    restaurants,
    walkOverrides,
    exclusions,
  )

  const updated = halls.map((hall) => {
    const area = masterResolver.getArea(hall.area_id)
    const matches = matcher.matchForHall(hall)
    const meal_guide = buildMealGuide(hall, area.name, matches)
    return { ...hall, meal_guide }
  })

  await fs.writeFile(hallsPath, JSON.stringify(updated, null, 2) + "\n", "utf8")
  console.log(
    `[populate-meal-guides] updated ${updated.length} halls in ${prefecture}`,
  )
  const lengths = updated.map((h) => h.meal_guide.length)
  console.log(
    `  length min=${Math.min(...lengths)} max=${Math.max(...lengths)} avg=${Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
