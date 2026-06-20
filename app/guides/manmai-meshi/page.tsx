import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"
import { buildArticleJsonLd, JsonLd } from "@/lib/seo"

const PAGE_PATH = "/guides/manmai-meshi"
const PAGE_TITLE = "万枚飯とは｜勝った日に食べたいパチスロユーザーのご褒美飯"
const PAGE_DESCRIPTION =
  "パチ屋飯が構想する「万枚飯」カテゴリについて。パチスロユーザー向けのご褒美飯の考え方と、今後の拡張予定を紹介します。"

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "article",
    locale: "ja_JP",
  },
  alternates: { canonical: PAGE_PATH },
}

export default function ManmaiMeshiGuidePage() {
  return (
    <StaticPageShell title="万枚飯とは" breadcrumbLabel="万枚飯">
      <JsonLd
        data={buildArticleJsonLd({
          headline: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
        })}
      />

      <p>
        万枚飯（まんまいはん）は、パチ屋飯が今後整備を検討しているカテゴリ候補です。パチンコ・パチスロユーザー、とりわけパチスロユーザーが、うまくいった日に食べたい「ご褒美の一食」を、ホール周辺の飲食店から紹介する枠を想定しています。現時点では正式なサイト機能としては未実装ですが、パチ屋飯が目指すメディア像を示す概念として本ページで紹介します。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          万枚飯という考え方
        </h3>
        <p className="mb-2">
          パチスロユーザーにとって、良い結果が出た日は、いつもより少し贅沢な食事を楽しみたくなるものです。万枚飯は、その日の気分に合わせて選ぶ「ご褒美飯」のカテゴリ名として考えています。期待値飯が「行く価値のある日常の一食」に近いのであれば、万枚飯は「特別な日の一食」に近い位置づけです。
        </p>
        <p>
          パチ屋飯は、稼働前後のサクッと飯だけでなく、うまくいった日の食事も楽しめるサイトを目指しています。ホール周辺の飲食情報を整理することで、パチンコ・パチスロユーザーの一日全体——稼働前、休憩中、終了後——を支えるメディアでありたいと考えています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          想定しているジャンル
        </h3>
        <p className="mb-2">
          万枚飯として紹介を想定しているのは、次のようなジャンルです。
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-2">
          <li>焼肉 — 遠征の締めくくりに相性がよい</li>
          <li>寿司・回転寿司 — 一人でも利用しやすいご褒美飯</li>
          <li>うなぎ — エリアの名店として記憶に残る一食</li>
          <li>高級とんかつ — 揚げたての満足感が高い</li>
        </ul>
        <p>
          いずれも、ホールからのアクセス、営業時間、一人利用のしやすさを考慮した上で、パチ屋飯の編集基準で選定する予定です。現時点では各ホールページの飲食店一覧から、ジャンルフィルター（焼肉、回転寿司など）で候補を探すことができます。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          設定6飯という構想
        </h3>
        <p className="mb-2">
          パチ屋飯内部では、万枚飯と並ぶ概念として「設定6飯（せってい6はん）」という構想もあります。名前の由来はパチスロ文化に触れていますが、サイト上ではあくまで「特別な日のご褒美飯」という食事カテゴリとして扱い、機種情報や示唆、結果の保証といった内容は一切掲載しません。
        </p>
        <p>
          パチ屋飯は飲食店情報メディアであり、パチンコ・パチスロの攻略情報サイトではありません。万枚飯・設定6飯は、食事選びの楽しみを広げるための編集カテゴリとして設計し、射幸心を煽る表現や結果を保証するような文言は使用しません。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          今後の展開
        </h3>
        <p className="mb-2">
          万枚飯は将来的な正式機能として、ホールページ上にカテゴリタグや専用セクションを設ける可能性があります。まずは期待値飯の整備と、エリア・ホールごとの編集コンテンツ充実を優先し、その上でご褒美飯カテゴリを段階的に追加していく方針です。パチンコ・パチスロユーザーが遠征の思い出として「あの店を食べた」と語れる体験を、食事面から支えたいと考えています。
        </p>
        <p>
          現時点で使える機能としては、
          <Link href="/areas" className="text-red-600 hover:text-red-700 font-medium">
            エリア一覧
          </Link>
          や各
          <Link href="/" className="text-red-600 hover:text-red-700 font-medium">
            ホール詳細ページ
          </Link>
          から、ジャンル・時間帯・徒歩分数で飲食店を絞り込めます。期待値飯の考え方については
          <Link href="/guides/kitaichimeshi" className="text-red-600 hover:text-red-700 font-medium">
            期待値飯とは
          </Link>
          もあわせてご覧ください。万枚飯は、パチンコ・パチスロユーザーの「食事も含めて遠征を楽しむ」文化を、パチ屋飯ならではの編集枠で表現していく試みです。
        </p>
      </div>

      <p className="text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-100">
        関連:
        <Link href="/" className="text-red-600 hover:text-red-700 ml-1">
          ホーム
        </Link>
        <span className="mx-1">·</span>
        <Link href="/guides/kitaichimeshi" className="text-red-600 hover:text-red-700">
          期待値飯とは
        </Link>
        <span className="mx-1">·</span>
        <Link href="/guides/expedition-meal" className="text-red-600 hover:text-red-700">
          遠征飯とは
        </Link>
        <span className="mx-1">·</span>
        <Link href="/about" className="text-red-600 hover:text-red-700">
          パチ屋飯とは
        </Link>
      </p>
    </StaticPageShell>
  )
}
