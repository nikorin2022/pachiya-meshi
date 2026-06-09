// パチ屋飯 - 共有型定義
// このサイトは「パチンコホール詳細ページに近隣飲食店を集約する」構造を主軸とし、
// 紹介対象は各ホールから徒歩10分以内の飲食店のみとする。

/**
 * 飲食店ジャンル。タイポ防止のため union 型で運用。
 * ジャンル追加時はここに追記し、必要に応じて `lib/ui-constants.ts` のフィルタにも反映する。
 *
 * - 寿司は原則「回転寿司」のみを想定（コース料理寿司などは対象外）
 */
export type Genre =
  | "ラーメン"
  | "カレー"
  | "とんかつ/カツ丼"
  | "そば/うどん"
  | "丼もの"
  | "回転寿司"
  | "焼肉"
  | "ハンバーガー"

/** 時間帯カテゴリ。複数選択可（朝＋昼のように兼用営業の店もある） */
export type TimeCategory = "朝" | "昼" | "夜"

/**
 * 飲食店データ。所属するパチンコホールから徒歩10分以内であることを前提とする。
 *
 * NOTE: `address` は UI 表示・データ識別用テキスト専用。Google マップ URL の生成には
 *        ホール名 + エリア名のみを使う（{@link "@/lib/maps".buildMapQuery} 参照）。
 */
export type Restaurant = {
  id: number
  /** 店舗正式名称（マップ検索クエリにも使用） */
  name: string
  genre: Genre
  /** 所属ホールからの徒歩分数（10以下のみ掲載） */
  walkMinutes: number
  time_category: TimeCategory[]
  hours: string
  /** ホール客視点の利用シーン要約。1〜2文程度 */
  ai_summary: string
  tags: string[]
  /** 表示用テキスト専用。マップ URL 生成には使わない */
  address: string
}

/**
 * パチンコホール。1ホール = 1詳細ページ = 1データファイル の運用。
 *
 * - `id` は URL slug としても利用される（例: "island-akihabara"）
 * - `area` は Google マップ検索クエリの後半に付与される地域語（例: "秋葉原"）
 *   ホール周辺の飲食店の検索クエリも同じ area で組み立てる
 */
export type PachinkoHall = {
  /** URL slug（半角英数 + ハイフンのみ） */
  id: string
  /** 正式名称（マップ検索クエリにも使用） */
  name: string
  /** マップ検索の地域語（例: "秋葉原"、"新宿"、"梅田"） */
  area: string
  /** 例: "東京都" */
  prefecture: string
  /** 例: "千代田区"（パンくず表示用） */
  city: string
  /** 表示用テキスト専用 */
  address: string
  /** 例: "JR秋葉原駅から徒歩2分 / 東京メトロ末広町駅から徒歩5分" */
  access: string
  hours: string
  /** パチンコ設置台数 */
  pachinko: number
  /** スロット設置台数 */
  slot: number
  /** このホールから徒歩10分以内の飲食店一覧 */
  restaurants: Restaurant[]
}
