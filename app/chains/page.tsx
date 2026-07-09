import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/SiteFooter"
import { getChainsWithHalls, getChainPagePath } from "@/lib/chains"
import { JsonLd, buildChainsIndexBreadcrumbJsonLd } from "@/lib/seo"

export const metadata: Metadata = {
  title: "パチンコホールチェーン一覧 | パチ屋飯",
  description:
    "掲載中のパチンコホールチェーン一覧です。楽園、マルハン、エスパスなどの店舗情報を掲載しています。",
  openGraph: {
    title: "パチンコホールチェーン一覧 | パチ屋飯",
    description:
      "掲載中のパチンコホールチェーン一覧です。楽園、マルハン、エスパスなどの店舗情報を掲載しています。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/chains" },
}

export default function ChainsPage() {
  const chains = getChainsWithHalls()

  return (
    <div className="min-h-screen bg-gray-50">
      <JsonLd data={buildChainsIndexBreadcrumbJsonLd()} />

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
        <nav className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
          <span className="mx-1">&gt;</span>
          <span className="text-gray-900">チェーン一覧</span>
        </nav>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            パチンコホールチェーン一覧
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            掲載中のチェーンから、店舗単位の周辺飲食店ガイドへ進めます。
            気になるチェーンを選んで、各ホール周辺のごはんスポットを確認してください。
          </p>
        </section>

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
            掲載中のチェーン（{chains.length}件）
          </h3>
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
                      <h4 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors">
                        {chain.name}
                      </h4>
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

        <SiteFooter />
      </main>
    </div>
  )
}
