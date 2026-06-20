import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"
import { buildArticleJsonLd, JsonLd } from "@/lib/seo"

const PAGE_PATH = "/guides/expedition-meal"
const PAGE_TITLE = "パチンコ・パチスロ遠征飯とは｜遠征先で失敗しない食事選び"
const PAGE_DESCRIPTION =
  "パチンコ・パチスロユーザーの遠征時に食事選びで失敗しないための考え方を解説。朝一・昼休憩・閉店後の使い分けと、パチ屋飯の活用法を紹介します。"

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

export default function ExpeditionMealGuidePage() {
  return (
    <StaticPageShell
      title="パチンコ・パチスロ遠征飯とは"
      breadcrumbLabel="遠征飯ガイド"
    >
      <JsonLd
        data={buildArticleJsonLd({
          headline: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
        })}
      />

      <p>
        パチンコ・パチスロユーザーにとって「遠征」とは、普段とは違うエリアのホールへ足を運び、一日を通して稼働する行動そのものです。有名店の台数、特定エリアの雰囲気、朝一抽選の有無など、遠征の理由は人それぞれですが、どの場合も共通して起きるのが「食事選びの迷い」です。地元では当たり前の店が分からず、休憩のたびにスマホ検索に時間を取られ、結果として稼働リズムを崩してしまう——そんな経験は少なくありません。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          なぜ遠征時の食事選びは難しいのか
        </h3>
        <p className="mb-2">
          遠征先では、ホールと飲食店の距離感、改札からの動線、エリアごとの店の偏りが地元とまったく異なります。特にパチスロユーザーは、特定の大型店や話題のホールへ移動するケースが多く、到着直後から「どこで食べるか」を判断する必要が出てきます。
        </p>
        <p>
          さらに、遠征日は時間配分がシビアです。朝一前の待機、短い昼休憩、閉店後の夜飯と、食事の目的が時間帯ごとに変わるため、一つの店を決め打ちするだけでは足りません。名店を探すより先に、「今の休憩時間で使える店」を見つけられるかどうかが、遠征の満足度を左右します。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          朝一・昼・閉店後で目的が変わる
        </h3>
        <p className="mb-2">
          朝一抽選前は、軽い食事やカフェでの待機が中心になります。座って休憩でき、短時間で済み、ホールへ戻る距離が短い店が求められます。昼休憩は回転の速いジャンル——丼もの、ラーメン、カレー、そば・うどんなど——が選ばれやすく、15〜30分程度で食事を終えられるかが重要です。
        </p>
        <p>
          閉店後は、一日の稼働を振り返りながらゆっくり食べる選択も増えます。遠征飯は「いつ・どのくらいの時間で・ホールからどれだけ離れるか」をセットで考えると、失敗が減ります。パチ屋飯では、ホールごとに時間帯タグと徒歩分数を掲載し、この使い分けを支援しています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          パチ屋飯が遠征飯選びを支援する理由
        </h3>
        <p className="mb-2">
          パチ屋飯では、ホールごとに徒歩圏内の飲食店を整理した地域特化メディアです。一般的な飲食検索のように全国の店を横断するのではなく、まずホールを起点に徒歩圏の候補を絞り込む設計にしています。遠征飯の失敗は、情報不足より「情報の絞り込み方」で起きることが多く、ホール起点の整理が有効です。
        </p>
        <p className="mb-2">
          各ホールページでは、周辺飲食店のジャンル、徒歩時間、朝・昼・夜の利用目安、パチ屋飯独自の解説（meal_guide）を確認できます。遠征前に候補店をメモしておけば、現地到着後に迷う時間を減らせます。
        </p>
        <p>
          現在は東京104ホールを掲載していますが、今後は全国の主要都市へ順次拡充する方針です。遠征先が増えても、同じ考え方——ホール起点で飯を選ぶ——で情報を探せるサイトを目指しています。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          遠征前に確認しておきたいポイント
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>ホールの最寄り駅と、飲食店密集エリアの位置関係</li>
          <li>朝一前に使える店があるか（営業開始時間）</li>
          <li>昼休憩向けの回転の速いジャンルがあるか</li>
          <li>閉店時間帯に利用できる店があるか</li>
          <li>ホールへ戻る徒歩時間（休憩の長さとの兼ね合い）</li>
        </ul>
        <p className="mt-2">
          遠征当日に初めてエリアを歩くより、前日までに
          <Link href="/areas" className="text-red-600 hover:text-red-700 font-medium">
            エリアページ
          </Link>
          と
          <Link href="/chains" className="text-red-600 hover:text-red-700 font-medium">
            チェーン一覧
          </Link>
          から候補を洗い出しておく方が、食事選びの失敗は減ります。パチ屋飯は、パチンコ・パチスロユーザーが「データベースを眺める」だけでなく、遠征の行動計画に組み込める情報を増やしていく方針です。
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
        <Link href="/guides/morning-cafe" className="text-red-600 hover:text-red-700">
          朝一カフェガイド
        </Link>
        <span className="mx-1">·</span>
        <Link href="/about" className="text-red-600 hover:text-red-700">
          パチ屋飯とは
        </Link>
      </p>
    </StaticPageShell>
  )
}
