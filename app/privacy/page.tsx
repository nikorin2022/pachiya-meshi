import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"

export const metadata: Metadata = {
  title: "プライバシーポリシー | パチ屋飯",
  description:
    "パチ屋飯における個人情報、Cookie、アクセス解析、広告配信等の取り扱いについて説明します。",
  openGraph: {
    title: "プライバシーポリシー | パチ屋飯",
    description:
      "パチ屋飯における個人情報、Cookie、アクセス解析、広告配信等の取り扱いについて説明します。",
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <StaticPageShell title="プライバシーポリシー" breadcrumbLabel="プライバシーポリシー">
      <p>
        パチ屋飯（以下「当サイト」）は、利用者の個人情報の保護に努めます。本ポリシーは、当サイトにおける情報の取り扱いについて定めるものです。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          個人情報の取り扱い
        </h3>
        <p>
          当サイトでは、お問い合わせメール等を通じて利用者から個人情報を取得する場合があります。取得した情報は、お問い合わせへの対応および掲載情報の修正等に必要な範囲でのみ利用し、適切に管理します。第三者への無断提供は行いません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">Cookieについて</h3>
        <p>
          当サイトでは、利便性の向上やアクセス状況の把握のため、Cookie（クッキー）を利用する場合があります。Cookieはブラウザの設定により無効化できますが、一部機能に影響する場合があります。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          アクセス解析について
        </h3>
        <p>
          当サイトでは、今後 Google Analytics 等のアクセス解析ツールを利用する場合があります。これらのツールはCookie等を用いてアクセス情報を収集する場合があり、匿名化された統計情報として分析に利用されます。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          広告配信について
        </h3>
        <p>
          当サイトでは、今後 Google AdSense 等の広告サービスを利用する場合があります。広告配信事業者は、利用者の興味に応じた広告を表示するため、Cookie等を使用することがあります。詳細は各広告サービスのプライバシーポリシーをご確認ください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          Google Search Console について
        </h3>
        <p>
          当サイトでは、サイトの検索パフォーマンス把握のため、Google Search Console を利用する場合があります。Search Console ではサイトのインデックス状況等を確認しますが、利用者個人を特定する情報の収集を目的とするものではありません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">免責事項</h3>
        <p>
          当サイトの情報は正確性の確保に努めていますが、内容の完全性・正確性・有用性を保証するものではありません。当サイトの利用により生じた損害について、当サイトは一切の責任を負いません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">お問い合わせ先</h3>
        <p>
          本ポリシーに関するお問い合わせは、
          <Link href="/contact" className="text-red-600 hover:text-red-700 font-medium">
            お問い合わせページ
          </Link>
          よりご連絡ください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          ポリシー改定について
        </h3>
        <p>
          当サイトは、必要に応じて本ポリシーの内容を変更することがあります。変更後のポリシーは、当ページに掲載した時点で効力を生じるものとします。関連する規約については
          <Link href="/terms" className="text-red-600 hover:text-red-700 font-medium">
            利用規約
          </Link>
          もあわせてご確認ください。
        </p>
      </div>
    </StaticPageShell>
  )
}
