import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"
import { buildArticleJsonLd, JsonLd } from "@/lib/seo"

const PAGE_PATH = "/guides/kitaichimeshi"
const PAGE_TITLE = "期待値飯とは｜パチ屋飯が選ぶ「行く価値のある一食」"
const PAGE_DESCRIPTION =
  "パチ屋飯独自の「期待値飯」の考え方を解説。パチンコ・パチスロユーザーにとって、ホール周辺で満足度の高い一食を見つけるための選定基準を紹介します。"

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

export default function KitaichimeshiGuidePage() {
  return (
    <StaticPageShell title="期待値飯とは" breadcrumbLabel="期待値飯">
      <JsonLd
        data={buildArticleJsonLd({
          headline: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
        })}
      />

      <p>
        期待値飯（きたいちはん）は、パチ屋飯が独自の基準で選定する「行く価値のある一食」です。外部の評価サービスや点数、第三者のランキング名に依存せず、パチンコ・パチスロユーザーがホール周辺で実際に使う場面を想定して、編集部が注目店舗として紹介する枠です。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          なぜ期待値飯という考え方があるのか
        </h3>
        <p className="mb-2">
          パチンコ・パチスロユーザーは、稼働中に食事を後回しにしがちです。しかし、せっかく遠征でその街を訪れるなら、休憩の合間に満足度の高い一食を取る価値は大きいと考えています。期待値飯は、その「食事にも期待値がある」というパチ屋飯の思想を、具体的な店舗紹介に落とし込んだものです。
        </p>
        <p>
          一般的な飲食店検索では情報量が多すぎて、パチンコ・パチスロユーザーが本当に知りたい「ホールから使えるか」「休憩時間に合うか」が見えにくい場合があります。期待値飯は、そのギャップを埋めるための編集部注目枠として位置づけています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          期待値飯の選定基準
        </h3>
        <p className="mb-2">
          期待値飯は、次の観点を総合的に考慮して選定します。
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-2">
          <li>ホールからの距離と徒歩時間</li>
          <li>ジャンルと食事の満足感</li>
          <li>エリアらしさ（その街で食べる意味があるか）</li>
          <li>遠征時の使いやすさ（短時間利用、戻りやすさ）</li>
          <li>パチンコ・パチスロ稼働前後に寄る価値</li>
        </ul>
        <p>
          大規模チェーン店は原則として期待値飯の対象外としています。どのエリアにもある店より、その土地ならではの店、ホール周辺で見つけやすい地場の名店を優先的に紹介する方針です。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          ランキングではない
        </h3>
        <p className="mb-2">
          期待値飯は「順位付けされた店舗リスト」ではありません。点数や順位で競わせるのではなく、パチ屋飯の編集部が「パチンコ・パチスロユーザーにとって行く価値がある」と判断した店を、ホールページ上で目立たせる仕組みです。
        </p>
        <p>
          同じエリアでも、ホールによって期待値飯の候補は異なります。ホールからの距離や動線が変わるため、Aホールの期待値飯がBホールからは遠すぎる、というケースもあります。ホールページごとに確認することが大切です。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          期待値飯と通常掲載店の違い
        </h3>
        <p className="mb-2">
          パチ屋飯のホールページには、徒歩10分圏内の飲食店を幅広く掲載しています。期待値飯は、その中から編集部が特に注目した店舗です。すべての掲載店が期待値飯ではない一方で、期待値飯は必ずしも「最も近い店」や「最も有名な店」ではありません。
        </p>
        <p>
          パチンコ・パチスロユーザーが休憩中に立ち寄る店として、距離・時間帯・ジャンルのバランスが取れているかを重視しています。たとえば、徒歩7分でもそのエリアでしか味わえない料理がある店、閉店後に使いやすい店など、状況に応じた「行く価値」を基準に選んでいます。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          ホールページでの確認方法
        </h3>
        <p className="mb-2">
          各ホール詳細ページでは、周辺飲食店一覧の中から期待値飯として選定した店舗を表示しています。あわせて「パチンコ・パチスロユーザー向け食事ガイド（meal_guide）」で、エリア全体の飯選びの考え方も確認できます。
        </p>
        <p>
          期待値飯の考え方の詳細や、パチ屋飯の運営方針については
          <Link href="/about" className="text-red-600 hover:text-red-700 font-medium">
            パチ屋飯とは
          </Link>
          ページもご覧ください。掲載内容の修正や掲載依頼は
          <Link href="/contact" className="text-red-600 hover:text-red-700 font-medium">
            お問い合わせ
          </Link>
          から受け付けています。
        </p>
        <p className="mt-2">
          期待値飯は、パチンコ・パチスロユーザーが遠征先で「せっかく来たから地元の味を楽しみたい」と思ったときの指針にもなります。短時間のサク飯だけでなく、エリアの特色を感じられる一食を、ホール周辺から無理なく選べる——それが期待値飯の目指す姿です。
        </p>
      </div>

      <p className="text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-100">
        関連:
        <Link href="/" className="text-red-600 hover:text-red-700 ml-1">
          ホーム
        </Link>
        <span className="mx-1">·</span>
        <Link href="/areas" className="text-red-600 hover:text-red-700">
          エリア一覧
        </Link>
        <span className="mx-1">·</span>
        <Link href="/guides/manmai-meshi" className="text-red-600 hover:text-red-700">
          万枚飯とは
        </Link>
        <span className="mx-1">·</span>
        <Link href="/about" className="text-red-600 hover:text-red-700">
          パチ屋飯とは
        </Link>
      </p>
    </StaticPageShell>
  )
}
