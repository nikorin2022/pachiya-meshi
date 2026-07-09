import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HallCardList } from "@/components/HallCardList"
import { SiteFooter } from "@/components/SiteFooter"
import {
  getAreaDetail,
  getAreaIdsWithHalls,
  getAreaPagePath,
} from "@/lib/areas"

type Params = { areaId: string }

export function generateStaticParams() {
  return getAreaIdsWithHalls().map((areaId) => ({ areaId }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { areaId } = await params
  const detail = getAreaDetail(areaId)

  if (!detail) {
    return {
      title: "エリアが見つかりません | パチ屋飯",
      robots: { index: false, follow: false },
    }
  }

  const { area } = detail
  const title = `${area.name}のパチンコホール周辺ごはん | パチ屋飯`
  const description = `${area.name}エリアのパチンコホール・パチスロホール周辺で利用しやすい飲食店情報を探せます。掲載ホール一覧から、休憩時間に行きやすいごはんスポットを確認できます。`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ja_JP",
    },
    alternates: { canonical: getAreaPagePath(area.id) },
  }
}

export default async function AreaDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { areaId } = await params
  const detail = getAreaDetail(areaId)

  if (!detail) {
    notFound()
  }

  const { area, halls } = detail

  return (
    <div className="min-h-screen bg-gray-50">
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
        <nav className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
          <span className="mx-1">&gt;</span>
          <Link href="/areas" className="hover:text-gray-900">
            エリア一覧
          </Link>
          <span className="mx-1">&gt;</span>
          <span className="text-gray-900">{area.name}</span>
        </nav>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <p className="text-[10px] sm:text-xs text-red-600 font-medium mb-1">
            {area.prefecture}
          </p>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            {area.name}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-3">
            {area.description_short}
          </p>
          <p className="text-xs sm:text-sm font-bold text-gray-900">
            掲載ホール {halls.length}件
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
            パチ屋飯エリアガイド
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {area.area_description}
          </p>
        </section>

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
            {area.name}のパチンコホール一覧
          </h3>
          <HallCardList halls={halls} />
        </section>

        <SiteFooter />
      </main>
    </div>
  )
}
