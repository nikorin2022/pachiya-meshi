import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"

export const metadata: Metadata = {
  title: "運営者情報 | パチ屋飯",
  description:
    "パチ屋飯の運営目的、掲載方針、サイト運営に関する情報を掲載しています。",
  openGraph: {
    title: "運営者情報 | パチ屋飯",
    description:
      "パチ屋飯の運営目的、掲載方針、サイト運営に関する情報を掲載しています。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <StaticPageShell title="運営者情報" breadcrumbLabel="運営者情報">
      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">サイト名</h3>
        <p>パチ屋飯</p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">運営目的</h3>
        <p>
          パチンコホール・パチスロホール周辺の飲食店情報を、ホール単位で探しやすくすることを目的として運営しています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          掲載情報について
        </h3>
        <p>
          当サイトに掲載しているホール・飲食店の情報は、各店舗の公式サイトや公開されている情報をもとに編集・整理しています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          情報の正確性について
        </h3>
        <p>
          営業時間・定休日・メニュー・住所などは変更される場合があります。ご来店前には、必ず各公式サイトや店舗の最新情報をご確認ください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">お問い合わせ</h3>
        <p>
          掲載内容の修正やお問い合わせは、
          <Link href="/contact" className="text-red-600 hover:text-red-700 font-medium">
            お問い合わせページ
          </Link>
          よりご連絡ください。
        </p>
      </div>
    </StaticPageShell>
  )
}
