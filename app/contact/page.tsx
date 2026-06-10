import type { Metadata } from "next"
import { StaticPageShell } from "@/components/StaticPageShell"

export const metadata: Metadata = {
  title: "お問い合わせ | パチ屋飯",
  description:
    "パチ屋飯へのお問い合わせ、掲載情報の修正依頼、店舗情報に関する連絡先ページです。",
  openGraph: {
    title: "お問い合わせ | パチ屋飯",
    description:
      "パチ屋飯へのお問い合わせ、掲載情報の修正依頼、店舗情報に関する連絡先ページです。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <StaticPageShell title="お問い合わせ" breadcrumbLabel="お問い合わせ">
      <p>
        パチ屋飯へのお問い合わせ、掲載情報の修正依頼、店舗情報の掲載依頼、掲載削除依頼は以下までご連絡ください。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          お問い合わせ先
        </h3>
        <p>
          <a
            href="mailto:nikorin2022@gmail.com"
            className="text-red-600 hover:text-red-700 font-medium break-all"
          >
            nikorin2022@gmail.com
          </a>
        </p>
      </div>

      <p>
        ご連絡内容によっては返信まで数日いただく場合があります。
        また、内容によっては回答できない場合がありますのでご了承ください。
      </p>
    </StaticPageShell>
  )
}
