import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Utensils } from "lucide-react"
import { getAllHalls } from "@/lib/halls"
import { JsonLd, SITE_DESCRIPTION, buildWebSiteJsonLd } from "@/lib/seo"
import { SiteFooter } from "@/components/SiteFooter"
import HallListClient from "./HallListClient"

export const metadata: Metadata = {
  title: "パチ屋飯 - 全国のパチンコホール・パチスロホール周辺ごはん検索",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "パチ屋飯 - 全国のパチンコホール・パチスロホール周辺ごはん検索",
    description: SITE_DESCRIPTION,
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
            <Image
              src="/favicon.png"
              alt="パチ屋飯"
              width={1254}
              height={1254}
              className="w-10 h-10 sm:w-12 sm:h-12 shrink-0"
            />
            <div>
              <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                パチ屋飯
              </h1>
              <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight hidden sm:block">
                パチンコ客のためのごはんスポット検索
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* ヒーロー画像（Header 直下・検索 UI より上）
            - hero-image.png は 1920x819 の横長。next/image で width/height を渡して
              CLS を防止しつつ、`w-full h-auto` で 100% 幅レスポンシブ表示する。
            - LCP 改善のため priority を付与。 */}
        <div className="mb-4 sm:mb-6">
          <Image
            src="/hero-image.png"
            alt="パチ屋飯"
            width={1920}
            height={819}
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="w-full h-auto rounded-xl shadow-sm"
          />
        </div>

        {/* ヒーローセクション */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            パチンコホール周辺の飯を、ホール単位で。
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            各ホールから徒歩10分以内で行ける飲食店を、朝飯・昼飯・夜飯やジャンル別にまとめています。
            <br className="hidden sm:block" />
            気になるホールを選ぶか、
            <Link href="/areas" className="text-red-600 hover:text-red-700 font-medium">
              エリア別
            </Link>
            から探してください。
          </p>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-600 bg-red-50 text-red-700 rounded-lg px-2.5 py-2 mt-3 sm:mt-4 w-fit">
            <Utensils className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span>掲載対象はホールから徒歩10分以内の飲食店のみ</span>
          </div>
        </section>

        {/* 検索 UI + ホール一覧（Client Component） */}
        <HallListClient halls={halls} />

        {/* フッター注釈 */}
        <p className="text-[10px] sm:text-xs text-gray-500 mt-6 sm:mt-8">
          ※営業時間やメニュー内容は変更されている場合があります。ご来店前に各店舗へご確認ください。
        </p>

        <SiteFooter />
      </main>
    </div>
  )
}
