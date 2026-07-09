import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/SiteFooter"
import { getAreasWithHalls, getAreaPagePath } from "@/lib/areas"

export const metadata: Metadata = {
  title: "パチンコホール周辺のごはんエリア一覧 | パチ屋飯",
  description:
    "パチンコホール・パチスロホール周辺の飲食店を、全国の掲載エリアから探せるページです。東京・大阪・福岡・名古屋・仙台・札幌など、エリア別にホール周辺のごはんスポットを確認できます。",
  openGraph: {
    title: "パチンコホール周辺のごはんエリア一覧 | パチ屋飯",
    description:
      "パチンコホール・パチスロホール周辺の飲食店を、全国の掲載エリアから探せるページです。東京・大阪・福岡・名古屋・仙台・札幌など、エリア別にホール周辺のごはんスポットを確認できます。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/areas" },
}

export default function AreasPage() {
  const areas = getAreasWithHalls()

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
        <nav className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
          <span className="mx-1">&gt;</span>
          <span className="text-gray-900">エリア一覧</span>
        </nav>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">
            パチンコホール周辺のごはんエリア一覧
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            エリアからホールを選び、周辺の飲食店を探せます。
            気になるエリアを選んで、ホール単位のごはんスポットを確認してください。
          </p>
        </section>

        <section>
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
            掲載中のエリア（{areas.length}件）
          </h3>
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
                      <h4 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors">
                        {area.name}
                      </h4>
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

        <SiteFooter />
      </main>
    </div>
  )
}
