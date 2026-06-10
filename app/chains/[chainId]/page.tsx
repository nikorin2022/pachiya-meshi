import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { HallCardList } from "@/components/HallCardList"
import { ChainBreadcrumb } from "@/components/ChainBreadcrumb"
import {
  getChainDetail,
  getChainIdsWithHalls,
  getChainPagePath,
} from "@/lib/chains"
import { JsonLd, buildChainBreadcrumbJsonLd } from "@/lib/seo"

type Params = { chainId: string }

export function generateStaticParams() {
  return getChainIdsWithHalls().map((chainId) => ({ chainId }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { chainId } = await params
  const detail = getChainDetail(chainId)

  if (!detail) {
    return {
      title: "チェーンが見つかりません | パチ屋飯",
      robots: { index: false, follow: false },
    }
  }

  const { chain } = detail
  const title = `${chain.name}の店舗一覧 | パチ屋飯`
  const description = `${chain.name}の掲載ホール一覧と周辺飲食店情報を紹介しています。`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ja_JP",
    },
    alternates: { canonical: getChainPagePath(chain.id) },
  }
}

export default async function ChainDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { chainId } = await params
  const detail = getChainDetail(chainId)

  if (!detail) {
    notFound()
  }

  const { chain, halls, areaCount } = detail

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={buildChainBreadcrumbJsonLd(chain)} />

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
        <ChainBreadcrumb chain={chain} />

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <p className="text-[10px] sm:text-xs text-red-600 font-medium mb-1">
            チェーン
          </p>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            {chain.name}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-3">
            {chain.description_short}
          </p>
          <div className="flex flex-wrap gap-3 text-xs sm:text-sm font-bold text-gray-900">
            <p>掲載ホール {halls.length}件</p>
            <p>掲載エリア {areaCount}エリア</p>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
            チェーンについて
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {chain.description}
          </p>
        </section>

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
            {chain.name}の掲載ホール一覧
          </h3>
          <HallCardList halls={halls} />
        </section>
      </main>
    </div>
  )
}
