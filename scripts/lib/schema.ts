// Zod スキーマ: data/ 配下の JSON ファイルの形式と業務ルールを宣言的に定義
//
// 設計方針:
//   - lat/lng は日本国内の範囲でバリデーション (タイポ即発覚)
//   - id は kebab-case 英数のみ (URL slug としても使うため)
//   - Genre / TimeCategory は lib/halls/types.ts の union と一致させる
//
// NOTE: lib/halls/types.ts に依存させると Phase B 時の型変更が波及するため、
//        スクリプト側で独立に enum を再定義する (二重管理リスクは generator
//        側のバリデーションで早期検知する方が運用コストが低い)。

import { z } from "zod"

const SlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/, "slug は kebab-case 英数のみ")

const LatSchema = z.number().min(24).max(46) // 日本本土の緯度範囲
const LngSchema = z.number().min(122).max(154) // 日本本土の経度範囲

const GenreSchema = z.enum([
  "ラーメン",
  "カレー",
  "とんかつ/カツ丼",
  "そば/うどん",
  "丼もの",
  "回転寿司",
  "焼肉",
  "ハンバーガー",
])

const TimeCategorySchema = z.enum(["朝", "昼", "夜"])

export const AreaSchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  prefecture: z.string().min(1),
  description_short: z.string().optional(),
  /** パチ屋飯独自のエリア解説（300〜500文字目安） */
  area_description: z.string().min(200),
  lat: LatSchema.optional(),
  lng: LngSchema.optional(),
})

export const ChainSchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  official_url: z.string().url().optional(),
  description_short: z.string().optional(),
  /** チェーン解説（150〜300文字目安） */
  description: z.string().min(100),
})

export const HallSchema = z.object({
  id: SlugSchema,
  name: z.string().min(1),
  area_id: SlugSchema,
  chain_id: SlugSchema.optional(),
  prefecture: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  access: z.string().min(1),
  hours: z.string().min(1),
  pachinko: z.number().int().nonnegative(),
  slot: z.number().int().nonnegative(),
  lat: LatSchema,
  lng: LngSchema,
  /** パチ屋飯独自のホールコメント（100〜250文字目安） */
  pachiya_comment: z.string().min(80),
  /** パチンコ・パチスロユーザー向け食事ガイド（200〜400文字目安） */
  meal_guide: z.string().min(180).max(500),
})

export const RestaurantSchema = z.object({
  id: SlugSchema,
  // Phase C 移行期間限定の数値 ID 互換用。既存 TS と diff を取るために残す。
  // Phase B で string slug へ完全移行する際に削除予定。
  legacy_id: z.number().int().positive().optional(),
  name: z.string().min(1),
  area_id: SlugSchema.optional(),
  genre: GenreSchema,
  time_category: z.array(TimeCategorySchema).min(1),
  hours: z.string().min(1),
  tags: z.array(z.string()),
  address: z.string().min(1),
  lat: LatSchema,
  lng: LngSchema,
  default_ai_summary: z.string().min(1),
  /** 期待値飯として表示するか（未指定は false）。生成データ・フロントへはこのフラグのみ渡す */
  is_kitaichimeshi: z.boolean().optional(),
  /** data/ 専用・内部管理用タグ。hall-builder で除外し生成データ・フロントへ渡さない */
  selection_tags: z.array(z.string()).optional(),
  /** data/ 専用・内部管理用メモ。hall-builder で除外し生成データ・フロントへ渡さない */
  selection_note: z.string().optional(),
})

export const WalkMinutesOverrideSchema = z.object({
  hall_id: SlugSchema,
  restaurant_id: SlugSchema,
  walkMinutes: z.number().int().min(1).max(10),
  reason: z.string().optional(),
})

export const AiSummaryOverrideSchema = z.object({
  hall_id: SlugSchema,
  restaurant_id: SlugSchema,
  ai_summary: z.string().min(1),
})

/**
 * 明示除外オーバーライド。
 *
 * 「自動距離計算では10分以内に入っているが、掲載方針として外したい」
 * ケース専用。walkMinutes を 99 で誤魔化したり lat/lng を不自然に
 * いじったりせず、ホール×店舗のペアで宣言的に除外する。
 *
 * - reason は必須（運用上、なぜ外したか後から追えるように）
 */
export const ExclusionOverrideSchema = z.object({
  hall_id: SlugSchema,
  restaurant_id: SlugSchema,
  reason: z.string().min(1),
})

export type Area = z.infer<typeof AreaSchema>
export type Chain = z.infer<typeof ChainSchema>
export type HallInput = z.infer<typeof HallSchema>
export type RestaurantInput = z.infer<typeof RestaurantSchema>
export type WalkMinutesOverride = z.infer<typeof WalkMinutesOverrideSchema>
export type AiSummaryOverride = z.infer<typeof AiSummaryOverrideSchema>
export type ExclusionOverride = z.infer<typeof ExclusionOverrideSchema>
