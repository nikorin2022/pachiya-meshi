import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { HallSearchForm } from "@/components/HallSearchForm"
import { HallSearchResultList } from "@/components/HallSearchResultList"
import { SiteFooter } from "@/components/SiteFooter"
import { searchHalls } from "@/lib/hall-search"

type SearchParams = { q?: string | string[] }

function resolveQuery(param: string | string[] | undefined): string {
  if (typeof param === "string") return param.trim()
  if (Array.isArray(param) && param[0]) return param[0].trim()
  return ""
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const { q } = await searchParams
  const query = resolveQuery(q)

  if (!query) {
    return {
      title: "ホール検索 | パチ屋飯",
      description: "パチンコホール名・エリア・チェーン名でホールを検索できます。",
      robots: { index: false, follow: true },
    }
  }

  return {
    title: `「${query}」のホール検索結果 | パチ屋飯`,
    description: `「${query}」でパチンコホールを検索した結果一覧です。`,
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q } = await searchParams
  const query = resolveQuery(q)
  const results = query ? searchHalls(query) : []
  const hasQuery = query.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-1 sm:gap-2 shrink-0">
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

            <div className="flex-1 max-w-md hidden md:block">
              <HallSearchForm
                defaultQuery={query}
                inputClassName=""
                buttonClassName="px-6"
              />
            </div>
          </div>

          <div className="mt-2 md:hidden">
            <HallSearchForm
              defaultQuery={query}
              inputClassName="text-sm h-9"
              buttonClassName="px-4 h-9 text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <nav className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
          <span className="mx-1">&gt;</span>
          <span className="text-gray-900">ホール検索</span>
        </nav>

        {!hasQuery ? (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 text-center">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
              ホールを検索
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              ホール名・エリア名・チェーン名で検索できます。
            </p>
          </section>
        ) : results.length > 0 ? (
          <section>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">
              「{query}」の検索結果（{results.length}件）
            </h2>
            <HallSearchResultList results={results} />
          </section>
        ) : (
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base font-bold text-gray-900 mb-2">
              該当するホールが見つかりませんでした。
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              キーワードを変えて、もう一度検索してください。
            </p>
          </section>
        )}

        <SiteFooter />
      </main>
    </div>
  )
}
