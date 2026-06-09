// 生成パイプライン全体のオーケストレーション
//
// フロー:
//   1. masters と overrides をロード (全都道府県横断)
//   2. 対象都道府県を列挙
//   3. 各都道府県について:
//      - halls / restaurants をロード
//      - area_id / chain_id の整合性チェック
//      - RestaurantMatcher で 10分以内の店舗を抽出
//      - HallBuilder で LegacyHall に組み立て
//      - TsEmitter で <prefecture>.ts に出力
//   4. _generated/index.ts を出力
//
// Phase C 中は失敗時に既存サイトを壊さないことが重要なので、
// 部分失敗ではなく**先頭で fail-fast** する設計にしている (例外は呼び出し側で catch)。

import type { PrefectureDataSource } from "../sources/types"
import { HallBuilder, type LegacyHall } from "./hall-builder"
import { MasterResolver } from "./master-resolver"
import { RestaurantMatcher } from "./restaurant-matcher"
import { TsEmitter } from "./ts-emitter"

export type GenerateOptions = {
  source: PrefectureDataSource
  outputRoot: string
  /** 未指定なら listPrefectures() の結果を使う */
  prefectures?: string[]
}

export type PrefectureSummary = {
  prefecture: string
  hallCount: number
  restaurantCount: number
  outputPath: string
}

export type GenerateResult = {
  prefectures: PrefectureSummary[]
  totalHalls: number
  totalRestaurants: number
  warnings: string[]
  indexPath: string
}

export async function generate(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const { source, outputRoot } = options
  const warnings: string[] = []

  const [areas, chains, walkOverrides, aiOverrides, exclusions] =
    await Promise.all([
      source.loadAreas(),
      source.loadChains(),
      source.loadWalkMinutesOverrides(),
      source.loadAiSummaryOverrides(),
      source.loadExclusions(),
    ])

  const masterResolver = MasterResolver.fromMasters(areas, chains)
  const hallBuilder = new HallBuilder(masterResolver, aiOverrides)
  const emitter = new TsEmitter(outputRoot)

  const targets = options.prefectures ?? (await source.listPrefectures())
  const summaries: PrefectureSummary[] = []
  let totalHalls = 0
  let totalRestaurants = 0

  for (const pref of targets) {
    const [halls, restaurants] = await Promise.all([
      source.loadHalls(pref),
      source.loadRestaurants(pref),
    ])

    if (halls.length === 0) {
      warnings.push(`${pref}: halls.json が空 (Step1 では正常)`)
    }

    // area_id / chain_id の参照整合性を先行検証 (失敗で throw)
    for (const h of halls) {
      masterResolver.getArea(h.area_id)
      if (h.chain_id) masterResolver.getChain(h.chain_id)
    }

    const matcher = new RestaurantMatcher(
      restaurants,
      walkOverrides,
      exclusions,
    )
    const builtHalls: LegacyHall[] = halls.map((h) => {
      const matches = matcher.matchForHall(h)
      if (matches.length === 0 && restaurants.length > 0) {
        warnings.push(
          `hall=${h.id}: 紐づく飲食店が 0 件 (徒歩10分以内なし)`,
        )
      }
      return hallBuilder.build(h, matches)
    })

    const outputPath = await emitter.emitPrefecture(pref, builtHalls)
    const restaurantCount = builtHalls.reduce(
      (sum, h) => sum + h.restaurants.length,
      0,
    )

    summaries.push({
      prefecture: pref,
      hallCount: builtHalls.length,
      restaurantCount,
      outputPath,
    })
    totalHalls += builtHalls.length
    totalRestaurants += restaurantCount
  }

  const indexPath = await emitter.emitIndex(targets)

  return {
    prefectures: summaries,
    totalHalls,
    totalRestaurants,
    warnings,
    indexPath,
  }
}
