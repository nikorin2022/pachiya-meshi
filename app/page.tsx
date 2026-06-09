import type { Metadata } from "next"
import Link from "next/link"
import { Utensils } from "lucide-react"
import { getAllHalls } from "@/lib/halls"
import { JsonLd, buildWebSiteJsonLd } from "@/lib/seo"
import HallListClient from "./HallListClient"

export const metadata: Metadata = {
  title: "パチンコ飯ナビ - 全国のパチンコホール周辺ごはん検索",
  description:
    "全国のパチンコホール周辺、徒歩10分以内で行ける飲食店をホール単位でまとめたガイドサイト。朝飯/昼飯/夜飯、ジャンル別に近くのお店を探せます。",
  openGraph: {
    title: "パチンコ飯ナビ - 全国のパチンコホール周辺ごはん検索",
    description:
      "全国のパチンコホール周辺、徒歩10分以内で行ける飲食店をホール単位でまとめたガイドサイト。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/" },
}

/**
 * トップページ: 登録済みのパチンコホール一覧。
 * 各カードをクリックすると、そのホール周辺の飲食店ガイドへ遷移する。
 *
 * - Server Component として metadata / JSON-LD / データ取得を担う
 * - 検索 UI と一覧描画はインタラクティブな state を持つため
 *   `HallListClient` (Client Component) に分離
 *
 * NOTE: 紹介対象は各ホールから徒歩10分以内の飲食店のみ。
 *       ホール詳細ページに近隣飲食店を集約する構造を主軸としている。
 */
export default function TopPage() {
  const halls = getAllHalls()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO: WebSite 構造化データ（ブランド情報をGoogleに伝える） */}
      <JsonLd data={buildWebSiteJsonLd()} />

      {/* ヘッダー（ホール詳細ページとほぼ同じ意匠を維持） */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <Link href="/" className="flex items-center gap-1 sm:gap-2 shrink-0 w-fit">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[10px] sm:text-xs font-bold">飯</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                パチンコ飯ナビ
              </h1>
              <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight hidden sm:block">
                パチンコ客のためのごはんスポット検索
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* ヒーローセクション */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            パチンコホール周辺の飯を、ホール単位で。
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            各ホールから徒歩10分以内で行ける飲食店を、朝飯・昼飯・夜飯やジャンル別にまとめています。
            <br className="hidden sm:block" />
            気になるホールを選んでください。
          </p>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 bg-red-50 text-red-700 rounded-lg px-2.5 py-2 mt-3 sm:mt-4 w-fit">
            <Utensils className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span>掲載対象はホールから徒歩10分以内の飲食店のみ</span>
          </div>
        </section>

        {/* 検索 UI + ホール一覧（Client Component） */}
        <HallListClient halls={halls} />

        {/* フッター注釈 */}
        <p className="text-[10px] sm:text-xs text-gray-500 mt-6 sm:mt-8 mb-4">
          ※営業時間やメニュー内容は変更されている場合があります。ご来店前に各店舗へご確認ください。
        </p>
      </main>
    </div>
  )
}
