import Image from "next/image"
import Link from "next/link"
import { SiteFooter } from "@/components/SiteFooter"

type Props = {
  title: string
  breadcrumbLabel: string
  children: React.ReactNode
}

/**
 * 運営者情報・お問い合わせ・ガイド（/guides/*）等の固定コンテンツページ用レイアウト。
 * 既存エリアページと同じヘッダー・カード意匠を踏襲し、ページ下部に SiteFooter を表示する。
 */
export function StaticPageShell({ title, breadcrumbLabel, children }: Props) {
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
          <span className="text-gray-900">{breadcrumbLabel}</span>
        </nav>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            {title}
          </h2>
          <div className="space-y-4 sm:space-y-6 text-xs sm:text-sm text-gray-600 leading-relaxed">
            {children}
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  )
}
