// データソース抽象化 interface
//
// 設計方針:
//   - 現在はファイル (FileDataSource) のみだが、将来 Google Places API 等で
//     差し替え可能にするため interface を切っておく
//   - 都道府県単位でデータを引けるよう、prefecture 引数を持たせる
//   - マスタ (areas/chains) と overrides は都道府県横断のため引数なし

import type {
  Area,
  Chain,
  HallInput,
  RestaurantInput,
  WalkMinutesOverride,
  AiSummaryOverride,
  ExclusionOverride,
} from "../lib/schema"

export interface PrefectureDataSource {
  /** エリアマスタ全件 */
  loadAreas(): Promise<Area[]>
  /** チェーンマスタ全件 */
  loadChains(): Promise<Chain[]>
  /** 利用可能な都道府県スラグ一覧 (例: ["tokyo", "kanagawa"]) */
  listPrefectures(): Promise<string[]>
  /** 指定都道府県のホール一覧 */
  loadHalls(prefecture: string): Promise<HallInput[]>
  /** 指定都道府県の飲食店一覧 */
  loadRestaurants(prefecture: string): Promise<RestaurantInput[]>
  /** 全都道府県横断の walkMinutes override */
  loadWalkMinutesOverrides(): Promise<WalkMinutesOverride[]>
  /** 全都道府県横断の ai_summary override */
  loadAiSummaryOverrides(): Promise<AiSummaryOverride[]>
  /** 全都道府県横断の明示除外オーバーライド */
  loadExclusions(): Promise<ExclusionOverride[]>
}
