// UI 共有定数
// ホール詳細ページのフィルタ・ジャンル別フォールバックスタイルなどを集約する。
// 新ジャンル追加時は genreFallbackStyles と genreFilters の両方を更新すること。

import { Sun, Utensils, Moon, type LucideIcon } from "lucide-react"
import type { Genre, TimeCategory } from "@/lib/halls/types"

/** 時間帯フィルター（朝/昼/夜） */
export const timeFilters: {
  id: TimeCategory
  label: string
  shortLabel: string
  icon: LucideIcon
}[] = [
  { id: "朝", label: "朝飯", shortLabel: "朝", icon: Sun },
  { id: "昼", label: "昼飯", shortLabel: "昼", icon: Utensils },
  { id: "夜", label: "夜飯", shortLabel: "夜", icon: Moon },
]

/** 徒歩時間フィルター（紹介対象は10分以内のため、5分/10分の2段階のみ） */
export const walkFilters: {
  id: string
  label: string
  maxMinutes: number
}[] = [
  { id: "5min", label: "5分以内", maxMinutes: 5 },
  { id: "10min", label: "10分以内", maxMinutes: 10 },
]

/** ジャンルフィルター。"all" はジャンル絞り込み解除用の特殊 ID */
export const genreFilters: {
  id: "all" | Genre
  label: string
  icon: string
}[] = [
  { id: "all", label: "すべて", icon: "🍴" },
  { id: "ラーメン", label: "ラーメン", icon: "🍜" },
  { id: "カレー", label: "カレー", icon: "🍛" },
  { id: "とんかつ/カツ丼", label: "とんかつ", icon: "🍱" },
  { id: "そば/うどん", label: "そば", icon: "🍝" },
  { id: "丼もの", label: "丼もの", icon: "🍚" },
  { id: "ハンバーガー", label: "ハンバーガー", icon: "🍔" },
  { id: "回転寿司", label: "回転寿司", icon: "🍣" },
  { id: "焼肉", label: "焼肉", icon: "🥩" },
]

/**
 * ジャンル別フォールバックスタイル
 * iframe 読み込み失敗時 / mapUrl 空時のグラデーション + 絵文字表示に使う。
 * 「パチンコ」はホール用フォールバック専用キー。
 */
export const genreFallbackStyles: Record<
  Genre | "パチンコ",
  { gradient: string; emoji: string }
> = {
  "ラーメン": { gradient: "from-orange-400 to-red-500", emoji: "🍜" },
  "カレー": { gradient: "from-yellow-400 to-orange-500", emoji: "🍛" },
  "とんかつ/カツ丼": { gradient: "from-amber-400 to-yellow-600", emoji: "🍱" },
  "そば/うどん": { gradient: "from-stone-400 to-amber-600", emoji: "🍝" },
  "丼もの": { gradient: "from-red-400 to-orange-500", emoji: "🍚" },
  "回転寿司": { gradient: "from-sky-400 to-blue-600", emoji: "🍣" },
  "焼肉": { gradient: "from-rose-500 to-red-700", emoji: "🥩" },
  "ハンバーガー": { gradient: "from-yellow-300 to-orange-600", emoji: "🍔" },
  "パチンコ": { gradient: "from-blue-500 to-purple-600", emoji: "🎰" },
}
