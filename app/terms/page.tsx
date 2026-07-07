import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"

export const metadata: Metadata = {
  title: "利用規約 | パチ屋飯",
  description:
    "パチ屋飯の利用条件、掲載情報、免責事項、禁止事項について説明します。",
  openGraph: {
    title: "利用規約 | パチ屋飯",
    description:
      "パチ屋飯の利用条件、掲載情報、免責事項、禁止事項について説明します。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <StaticPageShell title="利用規約" breadcrumbLabel="利用規約">
      <p>
        本規約は、パチ屋飯（以下「当サイト」）の利用条件を定めるものです。当サイトをご利用いただく際は、本規約に同意したものとみなします。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          サイト利用条件
        </h3>
        <p>
          当サイトは、パチンコホール・パチスロホール周辺の飲食店情報を提供する情報サイトです。利用者は自己の責任において当サイトを利用するものとし、法令および本規約を遵守してください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          掲載情報の正確性
        </h3>
        <p>
          当サイトに掲載するホール・飲食店の情報は、公開情報および独自調査をもとに編集しています。営業時間・定休日・住所・メニュー・提供内容等は予告なく変更される場合があり、最新情報は各公式サイト・店舗でご確認ください。ご来店・ご利用前には、必ず店舗・施設の公式情報をご確認ください。掲載内容の誤りを発見された場合は、
          <Link href="/contact" className="text-red-600 hover:text-red-700 font-medium">
            お問い合わせ
          </Link>
          よりご連絡ください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">禁止事項</h3>
        <ul className="list-disc pl-4 sm:pl-5 space-y-1">
          <li>当サイトの運営を妨害する行為</li>
          <li>不正アクセス、リバースエンジニアリング等の行為</li>
          <li>当サイトのコンテンツを無断で複製・転載・改変する行為</li>
          <li>虚偽の情報を用いたお問い合わせや迷惑行為</li>
          <li>その他、法令または公序良俗に反する行為</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          外部リンクについて
        </h3>
        <p>
          当サイトから外部サイト（Google Maps 等の地図サービス、各飲食店・ホールの公式サイト等）へのリンクが含まれる場合があります。外部サイトの内容・サービス・地図情報の正確性について、当サイトは一切の責任を負いません。外部サイトの利用は、各サイトの利用規約等に従ってください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">免責事項</h3>
        <p>
          当サイトの情報に基づいて行った行為の結果について、当サイトは一切の責任を負いません。飲食店への来店・注文、ホールへの来店等は、利用者ご自身の判断と責任において行ってください。当サイトの一時的な停止・変更・終了により生じた損害についても、当サイトは責任を負いません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          規約変更について
        </h3>
        <p>
          当サイトは、必要に応じて本規約を変更することがあります。変更後の規約は、当ページに掲載した時点で効力を生じるものとします。個人情報等の取り扱いについては
          <Link href="/privacy" className="text-red-600 hover:text-red-700 font-medium">
            プライバシーポリシー
          </Link>
          もあわせてご確認ください。
        </p>
      </div>
    </StaticPageShell>
  )
}
