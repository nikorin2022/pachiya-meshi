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
          当サイトでは、お問い合わせメール等を通じて利用者から氏名・メールアドレス等の個人情報を取得する場合があります。取得した情報は、お問い合わせへの対応、掲載情報の修正・確認、およびそれに付随する連絡に必要な範囲でのみ利用し、適切に管理します。法令に基づく場合を除き、本人の同意なく第三者へ提供することはありません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          Cookieおよび類似技術について
        </h3>
        <p className="mb-2">
          当サイトでは、利便性の向上、アクセス状況の把握、広告配信のため、Cookie（クッキー）およびこれに類する技術（ブラウザの localStorage 等）を利用します。
        </p>
        <p>
          お気に入りホール機能では、利用者の端末内にホールIDを保存します。Cookieや類似技術は、ブラウザの設定から無効化・削除できますが、一部機能（お気に入りの保存、アクセス解析、広告表示等）に影響する場合があります。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          アクセス解析について
        </h3>
        <p className="mb-2">
          当サイトでは、本番環境において Google Analytics（Google Analytics 4）を利用しています。Google Analytics は Cookie 等を用いてアクセス情報を収集し、個人を直接特定しない形でアクセス状況を分析し、サイトの改善に利用します。
        </p>
        <p className="mb-2">
          また、本番環境において Vercel Analytics を利用しています。Vercel Analytics は、ページの閲覧数やパフォーマンス等の集計情報を取得し、サイト運営・改善の参考にします。
        </p>
        <p>
          当サイトでは、サイトの検索パフォーマンス把握のため、Google Search Console も利用しています。Search Console ではサイトのインデックス状況等を確認しますが、利用者個人を特定する情報の収集を目的とするものではありません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          広告配信について
        </h3>
        <p className="mb-2">
          当サイトでは、Google AdSense（Google による広告配信サービス）を利用しています。本番環境では広告配信に必要なスクリプトを読み込んでいます。広告枠の設置状況はページにより異なり、すべてのページで広告が表示されるとは限りません。
        </p>
        <p className="mb-2">
          広告配信事業者（Google 等）は、利用者の興味や関心に応じた広告を表示するため、Cookie 等を使用して当サイトや他サイトへの過去のアクセス情報を収集することがあります。これにより、パーソナライズ広告（利用者の興味に応じた広告）が配信される場合があります。
        </p>
        <p className="mb-2">
          第三者配信事業者（Googleを含む）は、広告配信の結果として、利用者のブラウザにCookieを保存または参照したり、ウェブビーコン、IPアドレスその他の識別子を使用して情報を収集する場合があります。Googleによる広告Cookieの利用により、当サイトまたは他のウェブサイトへのアクセス情報に基づいた広告が配信される場合があります。詳しくは、
          <a
            href="https://policies.google.com/technologies/partner-sites?hl=ja"
            className="text-red-600 hover:text-red-700 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Googleがパートナーのサイトやアプリを使用する際の情報利用について
          </a>
          をご確認ください。
        </p>
        <p>
          パーソナライズ広告の無効化や Cookie の利用設定は、ブラウザの設定から変更できます。Google による広告の配信に関する詳細は、
          <a
            href="https://policies.google.com/technologies/ads"
            className="text-red-600 hover:text-red-700 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Googleの広告に関するポリシー
          </a>
          をご確認ください。パーソナライズ広告の設定変更は
          <a
            href="https://adssettings.google.com"
            className="text-red-600 hover:text-red-700 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google広告設定ページ
          </a>
          から行えます。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">免責事項</h3>
        <p>
          当サイトの情報は正確性の確保に努めていますが、内容の完全性・正確性・有用性を保証するものではありません。当サイトからリンクされている外部サイト（Google Maps 等を含む）の内容について、当サイトは一切の責任を負いません。当サイトの利用により生じた損害について、当サイトは一切の責任を負いません。
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
