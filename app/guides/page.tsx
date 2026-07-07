import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { StaticPageShell } from "@/components/StaticPageShell"
import { GUIDE_ENTRIES, GUIDE_INDEX_PATH } from "@/lib/guides"

const PAGE_TITLE = "パチ屋飯ガイド"
const PAGE_DESCRIPTION =
  "パチンコ・パチスロホール周辺の食事選びに役立つ、パチ屋飯の使い方・期待値飯・朝飯・遠征飯のガイドをまとめています。"

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: GUIDE_INDEX_PATH },
}

export default function GuidesIndexPage() {
  return (
    <StaticPageShell title={PAGE_TITLE} breadcrumbLabel="ガイド">
      <p>
        パチ屋飯をより便利に使うための読み物・ガイド集です。ホール周辺の食事選び、朝飯、遠征時の食事、期待値飯の考え方などをまとめています。
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {GUIDE_ENTRIES.map((guide) => (
          <li key={guide.path}>
            <Link
              href={guide.path}
              className="group flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4 hover:border-red-200 hover:bg-red-50/50 transition-colors"
            >
              <h3 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-red-600 transition-colors mb-1.5">
                {guide.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed flex-1">
                {guide.description}
              </p>
              <p className="flex items-center gap-0.5 text-[10px] sm:text-xs text-red-600 font-medium mt-2 group-hover:text-red-700">
                ガイドを読む
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </StaticPageShell>
  )
}
