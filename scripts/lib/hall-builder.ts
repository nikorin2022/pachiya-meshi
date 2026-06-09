// HallBuilder: マスタ + マッチ結果 → ランタイム PachinkoHall 形式
//
// Phase C の方針:
//   - 既存 lib/halls/types.ts の PachinkoHall / Restaurant 形式に**完全互換**で出力
//   - 新フィールド (area_id, chain, chain_id, restaurant.area 等) はまだ露出しない
//   - Phase B で type を拡張する際に、ここの build メソッドを差し替える
//
// id 互換性:
//   - 既存 Restaurant.id は number。新スキーマは string slug。
//   - Phase C 移行期は restaurants.json に任意で legacy_id を持たせて互換性を担保。
//   - legacy_id 未指定なら matches 順の index+1 を採用 (新規データは衝突しない番号付け)。

import type { AiSummaryOverride, HallInput } from "./schema"
import type { MatchedRestaurant } from "./restaurant-matcher"
import type { MasterResolver } from "./master-resolver"

// ----------------------------------------------------------------
// 出力型 (lib/halls/types.ts の PachinkoHall / Restaurant と同形)
// ----------------------------------------------------------------
export type LegacyRestaurant = {
  id: number
  name: string
  genre: string
  walkMinutes: number
  time_category: string[]
  hours: string
  ai_summary: string
  tags: string[]
  address: string
}

export type LegacyHall = {
  id: string
  name: string
  area: string
  prefecture: string
  city: string
  address: string
  access: string
  hours: string
  pachinko: number
  slot: number
  restaurants: LegacyRestaurant[]
}

export class HallBuilder {
  /** key = `${hall_id}|${restaurant_id}` */
  private readonly aiSummaryOverrideIndex: Map<string, string>

  constructor(
    private readonly masterResolver: MasterResolver,
    aiSummaryOverrides: AiSummaryOverride[],
  ) {
    this.aiSummaryOverrideIndex = new Map(
      aiSummaryOverrides.map((o) => [
        `${o.hall_id}|${o.restaurant_id}`,
        o.ai_summary,
      ]),
    )
  }

  /** 1 ホール + マッチ結果から LegacyHall を組み立てる */
  build(hall: HallInput, matches: MatchedRestaurant[]): LegacyHall {
    const area = this.masterResolver.getArea(hall.area_id)

    if (area.prefecture !== hall.prefecture) {
      throw new Error(
        `hall=${hall.id}: prefecture 不一致 ` +
          `(hall.prefecture="${hall.prefecture}", area.prefecture="${area.prefecture}")`,
      )
    }

    // chain_id は任意。指定された場合のみ存在チェック (失敗で throw)。
    if (hall.chain_id) this.masterResolver.getChain(hall.chain_id)

    const restaurants: LegacyRestaurant[] = matches.map((m, index) => {
      const overrideKey = `${hall.id}|${m.restaurant.id}`
      const ai_summary =
        this.aiSummaryOverrideIndex.get(overrideKey) ??
        m.restaurant.default_ai_summary

      const legacyId = m.restaurant.legacy_id ?? index + 1

      return {
        id: legacyId,
        name: m.restaurant.name,
        genre: m.restaurant.genre,
        walkMinutes: m.walkMinutes,
        time_category: [...m.restaurant.time_category],
        hours: m.restaurant.hours,
        ai_summary,
        tags: [...m.restaurant.tags],
        address: m.restaurant.address,
      }
    })

    return {
      id: hall.id,
      name: hall.name,
      area: area.name,
      prefecture: hall.prefecture,
      city: hall.city,
      address: hall.address,
      access: hall.access,
      hours: hall.hours,
      pachinko: hall.pachinko,
      slot: hall.slot,
      restaurants,
    }
  }
}
