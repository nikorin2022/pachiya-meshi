import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Utensils } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { HallCardList } from "@/components/HallCardList"
import { getAllHalls } from "@/lib/halls"
import type { PachinkoHall } from "@/lib/halls/types"
import { getAreasWithHalls, getAreaPagePath } from "@/lib/areas"
import { getChainsWithHalls, getChainPagePath } from "@/lib/chains"
import { countKitaichimeshiForHall } from "@/lib/kitaichimeshi"
import { JsonLd, buildWebSiteJsonLd } from "@/lib/seo"
import { SiteFooter } from "@/components/SiteFooter"
import HallListClient from "./HallListClient"

const TOP_PAGE_TITLE =
  "パチ屋飯｜パチンコ・パチスロホール周辺の飲食店検索メディア"
const TOP_PAGE_DESCRIPTION =
  "パチ屋飯は、パチンコ・パチスロユーザー向けにホール周辺の飲食店を探しやすくする地域特化メディアです。徒歩時間・ジャンル・期待値飯から、稼働前後の一食を素早く探せます。"

const POPULAR_AREA_IDS = [
  "akihabara",
  "shinjuku",
  "ikebukuro",
  "shibuya",
  "ueno",
  "yurakucho",
] as const

const KITAICHIMESHI_HALL_LIMIT = 9

const linkButtonClassName =
  "inline-flex items-center gap-1 text-xs sm:text-sm text-red-600 hover:text-red-700 font-bold bg-red-50 border border-red-200 rounded-lg px-3 py-2 transition-colors"

export const metadata: Metadata = {
  title: TOP_PAGE_TITLE,
  description: TOP_PAGE_DESCRIPTION,
  openGraph: {
    title: TOP_PAGE_TITLE,
    description: TOP_PAGE_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/" },
}

function getHallsWithKitaichimeshi(
  halls: readonly PachinkoHall[],
  limit: number,
): PachinkoHall[] {
  return [...halls]
    .filter((hall) => countKitaichimeshiForHall(hall) > 0)
    .sort(
      (a, b) =>
        countKitaichimeshiForHall(b) - countKitaichimeshiForHall(a),
    )
    .slice(0, limit)
}

/**
 * トップページ: ヒーロー・編集コンテンツ導線・エリア/チェーン/ホール一覧。
 * 各ホールカードから周辺飲食店ガイドへ遷移する。
 *
 * - Server Component として metadata / JSON-LD / データ取得を担う
 * - 検索 UI と一覧描画は `HallListClient` (Client Component) に分離
 */
export default function TopPage() {
  const halls = getAllHalls()
  const areas = getAreasWithHalls()
  const chains = getChainsWithHalls()
  const popularAreas = POPULAR_AREA_IDS.map((id) =>
    areas.find((area) => area.id === id),
  ).filter((area): area is NonNullable<typeof area> => area != null)
  const kitaichimeshiHalls = getHallsWithKitaichimeshi(halls, KITAICHIMESHI_HALL_LIMIT)

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={buildWebSiteJsonLd()} />

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

        {/* ① ヒーローセクション */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            パチンコ帰りの一杯を探そう。
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            パチ屋飯は、パチンコ・パチスロユーザー向けにホール周辺の飲食店情報を探しやすくする地域特化メディアです。
            徒歩時間やジャンルから、稼働前・稼働後の一食を素早く探せます。
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4">
            <Link href="/areas" className={linkButtonClassName}>
              エリアから探す
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
            <Link href="#halls" className={linkButtonClassName}>
              ホールから探す
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs bg-red-50 text-red-700 rounded-lg px-2.5 py-2 mt-3 sm:mt-4 w-fit">
            <Utensils className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span>掲載対象はホールから徒歩10分以内の飲食店のみ</span>
          </div>
        </section>

        {/* ② パチ屋飯とは */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
            パチ屋飯とは
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            私たちは「美味しい食事も人生単位で見ると期待値が高い」と考えています。
            パチンコやパチスロの稼働だけでなく、その街ならではの食事も楽しんでほしい。
            パチ屋飯は、ホール周辺の飲食店との出会いを応援する編集メディアです。
          </p>
          <Link href="/about" className={`${linkButtonClassName} mt-3 sm:mt-4`}>
            詳しく見る
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </section>

        {/* ③ 人気エリア */}
        <section className="mb-4 sm:mb-6">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">人気エリア</h2>
            <Link
              href="/areas"
              className="text-[10px] sm:text-xs text-red-600 hover:text-red-700 font-bold"
            >
              すべてのエリアを見る
            </Link>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {popularAreas.map((area) => (
              <li key={area.id}>
                <Link
                  href={getAreaPagePath(area.id)}
                  className="group block bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md hover:border-red-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-200 text-[10px] sm:text-xs mb-1.5"
                      >
                        {area.prefecture}
                      </Badge>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors">
                        {area.name}
                      </h3>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1 group-hover:text-red-500 transition-colors" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-600 mb-3 line-clamp-2">
                    {area.description_short}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-500 font-medium">
                    掲載ホール {area.hallCount}件
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ④ 期待値飯があるホール */}
        {kitaichimeshiHalls.length > 0 ? (
          <section className="mb-4 sm:mb-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 mb-1">
              🔥期待値飯があるホール
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-600 mb-3 sm:mb-4">
              パチ屋飯独自基準で選定した期待値飯を楽しめるホールです。
            </p>
            <HallCardList halls={kitaichimeshiHalls} />
          </section>
        ) : null}

        {/* ⑤ エリア一覧 */}
        <section className="mb-4 sm:mb-6">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">
              エリア一覧（{areas.length}件）
            </h2>
            <Link
              href="/areas"
              className="text-[10px] sm:text-xs text-red-600 hover:text-red-700 font-bold"
            >
              エリア一覧ページへ
            </Link>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {areas.map((area) => (
              <li key={area.id}>
                <Link
                  href={getAreaPagePath(area.id)}
                  className="group block bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md hover:border-red-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-200 text-[10px] sm:text-xs mb-1.5"
                      >
                        {area.prefecture}
                      </Badge>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors">
                        {area.name}
                      </h3>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1 group-hover:text-red-500 transition-colors" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-600 mb-3 line-clamp-2">
                    {area.description_short}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-500 font-medium">
                    掲載ホール {area.hallCount}件
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ⑥ チェーン一覧 */}
        <section className="mb-4 sm:mb-6">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">
              チェーン一覧（{chains.length}件）
            </h2>
            <Link
              href="/chains"
              className="text-[10px] sm:text-xs text-red-600 hover:text-red-700 font-bold"
            >
              チェーン一覧ページへ
            </Link>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {chains.map((chain) => (
              <li key={chain.id}>
                <Link
                  href={getChainPagePath(chain.id)}
                  className="group block bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 hover:shadow-md hover:border-red-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-200 text-[10px] sm:text-xs mb-1.5"
                      >
                        チェーン
                      </Badge>
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors">
                        {chain.name}
                      </h3>
                    </div>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1 group-hover:text-red-500 transition-colors" />
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-600 mb-3 line-clamp-2">
                    {chain.description_short}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-500 font-medium">
                    掲載ホール {chain.hallCount}件
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <HallListClient halls={halls} />

        {/* ⑦ Aboutページ導線 */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mt-4 sm:mt-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
            パチ屋飯について
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            サイトの考え方や期待値飯の選定基準を掲載しています。
          </p>
          <Link href="/about" className={`${linkButtonClassName} mt-3 sm:mt-4`}>
            運営方針を見る
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </section>

        <p className="text-[10px] sm:text-xs text-gray-500 mt-6 sm:mt-8">
          ※営業時間やメニュー内容は変更されている場合があります。ご来店前に各店舗へご確認ください。
        </p>

        <SiteFooter />
      </main>
    </div>
  )
}
