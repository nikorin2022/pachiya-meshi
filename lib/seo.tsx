// SEO 共通ヘルパ
// - サイト全体で使う URL / 名称定数
// - JSON-LD 出力用の小さな <script> ラッパコンポーネント
// - 構造化データ（JSON-LD）のオブジェクトビルダー

import type { PachinkoHall } from "@/lib/halls/types"

/** 本番ドメイン。metadataBase / sitemap / robots / 構造化データの絶対URL基準 */
export const SITE_URL = "https://www.gameexpect.com"

/** サイト名（OG / 構造化データ等で使用） */
export const SITE_NAME = "パチ屋飯"

/** サイト説明（fallback 用 / meta description 統一文言） */
export const SITE_DESCRIPTION =
  "パチンコホール・パチスロホール周辺の飲食店を探せる「パチ屋飯」。ラーメン、カレー、丼もの、とんかつ、そば・うどんなど、休憩時間でも利用しやすい店舗をまとめています。"

/**
 * JSON-LD を <script type="application/ld+json"> として出力する小さなコンポーネント。
 * Server Component から呼び出して初期 HTML に埋め込む。
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // schema.org への構造化データ。XSS リスクは無いが React は <script> 子要素を
      // 直接受け付けないため dangerouslySetInnerHTML を使う必要がある。
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/**
 * WebSite JSON-LD（トップページ向け）。
 * Google にサイト全体のブランド情報を伝える。
 * NOTE: SearchAction（サイト内検索）は現状未実装のため含めない。
 *       将来サイト内検索を実装したら追加すること。
 */
export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    // 関連検索の取りこぼし防止。サイト本体の別表記を JSON-LD で Google に伝える。
    alternateName: ["パチ飯", "パチンコ飯", "パチスロ飯"],
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "ja",
  }
}

/**
 * BreadcrumbList JSON-LD（ホール詳細ページ向け）。
 *
 * 現状サイトの内部リンク構造では、都道府県・市区にまだ専用ページが無いため、
 * パンくずの構造化データは以下の2階層のみを宣言する:
 *   1. ホーム (/)
 *   2. {ホール名} 周辺の飲食店 (/halls/{id})
 *
 * 将来 /halls?prefecture=東京都 等の中間ページが入ったら、その時点で
 * 中間 ListItem を追加する。
 */
export function buildHallBreadcrumbJsonLd(hall: PachinkoHall) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ホーム",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${hall.name} 周辺の飲食店`,
        item: `${SITE_URL}/halls/${hall.id}`,
      },
    ],
  }
}
