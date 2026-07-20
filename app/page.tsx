import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Utensils } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { HallCardList } from "@/components/HallCardList"
import { getAllHalls } from "@/lib/halls"
import type { PachinkoHall } from "@/lib/halls/types"
import { getAreasWithHalls, getAreaPagePath } from "@/lib/areas"
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
  "umeda",
  "nanba",
  "sapporo-ekimae",
  "hakata",
  "tenjin",
  "nagoya-ekimae",
] as const

const KITAICHIMESHI_HALL_LIMIT = 6
const TOP_HALL_LIMIT = 6
const HERO_ASPECT_WIDTH = 2172
const HERO_ASPECT_HEIGHT = 724

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

/** 飲食店掲載数が多いホール（0件除外、3件以上を優先） */
function getTopHallsByRestaurants(
  halls: readonly PachinkoHall[],
  limit: number,
): PachinkoHall[] {
  const withRestaurants = halls.filter((hall) => hall.restaurants.length > 0)
  const preferred = withRestaurants.filter((hall) => hall.restaurants.length >= 3)
  const pool = preferred.length >= limit ? preferred : withRestaurants

  return [...pool]
    .sort((a, b) => b.restaurants.length - a.restaurants.length)
    .slice(0, limit)
}

/**
 * トップページ: ヒーロー・編集コンテンツ導線・各一覧ページへの誘導。
 * 各ホールカードから周辺飲食店ガイドへ遷移する。
 *
 * - Server Component として metadata / JSON-LD / データ取得を担う
 * - 検索 UI と一覧描画は `HallListClient` (Client Component) に分離
 */
export default function TopPage() {
  const halls = getAllHalls()
  const areas = getAreasWithHalls()
  const popularAreas = POPULAR_AREA_IDS.map((id) =>
    areas.find((area) => area.id === id),
  ).filter((area): area is NonNullable<typeof area> => area != null)
  const kitaichimeshiHalls = getHallsWithKitaichimeshi(halls, KITAICHIMESHI_HALL_LIMIT)
  const topHalls = getTopHallsByRestaurants(halls, TOP_HALL_LIMIT)

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={buildWebSiteJsonLd()} />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <Link href="/" className="flex items-center gap-1 sm:gap-2 shrink-0 w-fit">
            <Image
              src="/pachiya-meshi-icon.png"
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
        {/* ① ヒーローセクション（検索導線をファーストビューに） */}
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

        <HallListClient halls={halls} />

        {/* 飲食店が多いホール（未検索時の導線） */}
        {topHalls.length > 0 ? (
          <section className="mb-4 sm:mb-6">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 mb-1">
              飲食店が多いホール
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-600 mb-3 sm:mb-4">
              周辺の飯が充実しているホールから、まず見てみたい店舗を選べます。
            </p>
            <HallCardList halls={topHalls} />
          </section>
        ) : null}

        {/* ヒーロー画像（検索導線の下に配置・WebP最適化） */}
        <div className="mb-4 sm:mb-6">
          <img
            src="/pachiya-meshi-hero.webp"
            alt="パチ屋飯 - ホール周辺の飲食店検索"
            width={HERO_ASPECT_WIDTH}
            height={HERO_ASPECT_HEIGHT}
            decoding="async"
            fetchPriority="high"
            className="w-full h-auto max-h-40 sm:max-h-none object-cover sm:object-contain rounded-xl shadow-sm"
          />
        </div>

        {/* 人気エリア */}
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

        <section className="mb-4 sm:mb-6">
          <Link href="/areas" className={linkButtonClassName}>
            エリア一覧を見る
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </section>

        <section className="mb-4 sm:mb-6">
          <Link href="/chains" className={linkButtonClassName}>
            チェーン一覧を見る
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </section>

        {/* パチ屋飯とは（重複セクションを統合） */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
            パチ屋飯とは
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-2">
            パチンコ・パチスロユーザー向けに、ホール周辺の飲食店情報を整理する地域特化メディアです。
            徒歩10分以内の店舗を、朝飯・昼飯・夜飯などの利用シーンから探せます。
          </p>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            実在確認と正確性を重視し、架空の店舗情報は掲載しません。
            サイトの考え方や期待値飯の選定基準は運営方針ページでご確認いただけます。
          </p>
          <Link href="/about" className={`${linkButtonClassName} mt-3 sm:mt-4`}>
            運営方針を見る
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
            ミニゲーム
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-3 sm:mb-4">
            ドラムを回して結果を楽しむ、オリジナルのミニゲームです。
          </p>
          <Link
            href="/games/shin-omoshiroi-yatsu"
            className={linkButtonClassName}
          >
            真のおもしろいやつ風のなにか
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
