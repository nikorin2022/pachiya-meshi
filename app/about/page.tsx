import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"
import { JsonLd, SITE_NAME, SITE_URL } from "@/lib/seo"

const PAGE_TITLE = "パチ屋飯とは｜運営方針・期待値飯・掲載情報"
const PAGE_DESCRIPTION =
  "パチ屋飯は、パチンコ・パチスロユーザー向けにホール周辺の飲食店を探しやすくする地域特化メディアです。運営目的、期待値飯の考え方、情報掲載方針をご説明します。"

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: "/about" },
}

const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "パチ屋飯とは",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/about`,
  inLanguage: "ja",
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
  },
}

export default function AboutPage() {
  return (
    <StaticPageShell title="パチ屋飯とは" breadcrumbLabel="運営者情報">
      <JsonLd data={aboutPageJsonLd} />

      <p>
        パチ屋飯は、全国のパチンコ・パチスロホール周辺の飲食店情報を整理する地域特化メディアです。ホールごとに徒歩圏内の飲食店を整理し、休憩時間や移動の合間に食事先を素早く見つけられるよう編集しています。ギャンブル攻略や射幸心を煽る内容ではなく、周辺の飲食店・休憩・食事の情報提供を目的としています。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          なぜ作ったのか
        </h3>
        <p className="mb-2">
          パチンコ・パチスロユーザーは、稼働中に食事を後回しにしがちです。また一般的な飲食店検索サイトは情報量が多く、パチンコユーザーが本当に知りたい情報へたどり着くまで時間がかかります。
        </p>
        <p className="mb-2">パチ屋飯では、ホールを起点に次の情報を素早く探せるようにしています。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>徒歩何分か</li>
          <li>朝飯に使えるか</li>
          <li>昼飯に使えるか</li>
          <li>夜飯に使えるか</li>
          <li>どんなジャンルか</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          パチ屋飯の考え方
        </h3>
        <p className="mb-2">
          私たちは「美味しい食事も人生単位で見ると期待値が高い」と考えています。
        </p>
        <p className="mb-2">
          パチンコやパチスロには期待値があります。しかし人生全体で考えると、満足できる食事にも大きな価値があります。
        </p>
        <p>
          せっかくホールへ行くなら、せっかくその街へ行くなら、その街ならではの美味しい食事も楽しんでほしい。パチ屋飯は、そんな食事との出会いを応援します。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          期待値飯について
        </h3>
        <p className="mb-2">
          期待値飯は、パチ屋飯独自の基準で選定した注目店舗です。評価サイトの点数やランキングではなく、次の観点を総合的に考慮しています。
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>ホールからのアクセス</li>
          <li>エリアらしさ</li>
          <li>食事としての満足感</li>
          <li>パチンコ帰りに寄る価値</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          情報掲載方針
        </h3>
        <p className="mb-2">
          掲載情報は独自調査および公開情報をもとに、編集部が作成・整理しています。ホール・飲食店の基本情報、徒歩時間、時間帯タグ、ジャンルなどは、パチンコユーザーが休憩先を選びやすいよう独自の視点でまとめています。
        </p>
        <p className="mb-2">
          実在確認が取れた店舗、ホールから徒歩10分以内で通常利用できる飲食店を優先して掲載しています。情報が十分に確認できない場合は掲載を見送ることがあり、周辺店舗の確認中である旨を案内する場合があります。
        </p>
        <p>
          営業時間やサービス内容は変更される場合があります。ご利用前に、店舗・施設の公式情報をご確認ください。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">今後について</h3>
        <p className="mb-2">パチ屋飯では今後も、次の取り組みを継続していきます。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>エリア追加</li>
          <li>ホール追加</li>
          <li>飲食店追加</li>
          <li>編集コンテンツ追加</li>
        </ul>
        <p className="mt-2">
          パチ屋飯の使い方や食事選びの考え方は、
          <Link href="/guides" className="text-red-600 hover:text-red-700 font-medium">
            ガイドページ
          </Link>
          でも紹介しています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">運営者</h3>
        <p>パチ屋飯運営事務局</p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">サイト名</h3>
        <p>パチ屋飯（{SITE_URL.replace("https://", "")}）</p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">お問い合わせ</h3>
        <p>
          掲載内容の修正、掲載依頼、お問い合わせは
          <Link href="/contact" className="text-red-600 hover:text-red-700 font-medium">
            お問い合わせページ
          </Link>
          よりご連絡ください。
        </p>
      </div>

      <p className="text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-100">
        関連:
        <Link href="/privacy" className="text-red-600 hover:text-red-700 ml-1">
          プライバシーポリシー
        </Link>
        <span className="mx-1">·</span>
        <Link href="/terms" className="text-red-600 hover:text-red-700">
          利用規約
        </Link>
      </p>
    </StaticPageShell>
  )
}
