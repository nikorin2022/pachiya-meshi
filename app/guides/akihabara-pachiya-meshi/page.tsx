import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"
import { buildArticleJsonLd, JsonLd } from "@/lib/seo"

const PAGE_PATH = "/guides/akihabara-pachiya-meshi"
const PAGE_TITLE =
  "秋葉原のパチ屋飯ガイド｜パチンコ・パチスロ遠征で使いやすい飯選び"
const PAGE_DESCRIPTION =
  "秋葉原エリアのパチンコ・パチスロ遠征向け食事ガイド。有名ホール周辺の飯選び、朝一・昼休憩・閉店後の使い分け、主要ホールへの導線を紹介します。"

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

export default function AkihabaraPachiyaMeshiGuidePage() {
  return (
    <StaticPageShell
      title="秋葉原のパチ屋飯ガイド"
      breadcrumbLabel="秋葉原ガイド"
    >
      <JsonLd
        data={buildArticleJsonLd({
          headline: PAGE_TITLE,
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
        })}
      />

      <p>
        秋葉原は、パチンコ・パチスロユーザーの遠征需要が特に強いエリアのひとつです。JR秋葉原駅を中心に、大型ホールが複数集中しており、電気街のガード下飲食と駅前チェーンが混在する独特の飲食環境があります。遠征で秋葉原を訪れる場合、ホール選びと同時に「どの時間帯にどのジャンルで食べるか」を整理しておくと、一日を無駄なく過ごしやすくなります。
      </p>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          秋葉原が遠征先として選ばれる理由
        </h3>
        <p className="mb-2">
          秋葉原には、アイランド、エスパス日拓、ビッグアップル、UNOなど、台数の厚い有名ホールが徒歩圏に並びます。パチスロユーザーは特定機種の台数、パチンコユーザーは大型店の存在を理由に遠征するケースが多く、エリア全体の稼働需要が高いのが特徴です。駅ビルやガード下、ロードサイドと、飲食店の立地パターンも複数あり、初めて訪れるパチンコ・パチスロユーザーほど事前調査の効果が大きいエリアです。
        </p>
        <p>
          飲食面では、ラーメン、カレー、とんかつ・カツ丼、丼もの、そば・うどんなど、短時間で食事が済むジャンルが豊富です。ガード下の立ち食い系から、駅前のチェーン店まで選択肢が広く、休憩の長さに合わせて店を変えやすいエリアといえます。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          時間帯別の飯選び
        </h3>
        <p className="mb-2">
          <strong className="font-medium text-gray-800">朝一前</strong>
          — 電気街口・昭和通り口周辺のカフェやモーニング営業店で軽く食べ、抽選前の待機を屋内で過ごす使い方が向いています。ホールとの距離を優先しましょう。
        </p>
        <p className="mb-2">
          <strong className="font-medium text-gray-800">昼休憩</strong>
          — 丼もの、ラーメン、カレーなど回転の速い店が中心です。15〜30分の休憩なら、ホールから徒歩5分以内の店を候補にすると戻りやすいです。
        </p>
        <p>
          <strong className="font-medium text-gray-800">閉店後</strong>
          — 末広町方面や駅前の飲食店で、一日の稼働を振り返りながら食事するパターンも多いです。閉店時間が22時台のホールが多いため、夜営業の店を事前に確認しておくと安心です。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          秋葉原の主要ホール
        </h3>
        <p className="mb-2">
          パチ屋飯では、秋葉原エリアの主要ホールについて、周辺飲食店とパチンコ・パチスロユーザー向け食事ガイド（meal_guide）を掲載しています。遠征前に各ホールページで候補店を確認しておくと、現地での迷いが減ります。
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link
              href="/halls/island-akihabara"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              アイランド秋葉原店
            </Link>
            — 電気街口から徒歩5分、スロット台数が厚い
          </li>
          <li>
            <Link
              href="/halls/espace-akihabara-ekimae"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              エスパス日拓秋葉原駅前店
            </Link>
            — 電気街口目の前、駅前飲食へ最短
          </li>
          <li>
            <Link
              href="/halls/big-apple-akihabara"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              ビッグアップル．秋葉原店
            </Link>
            — 電気街南口徒歩2分
          </li>
          <li>
            <Link
              href="/halls/uno-akihabara"
              className="text-red-600 hover:text-red-700 font-medium"
            >
              秋葉原UNO
            </Link>
            — ガード下徒歩1分、改札直近
          </li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          エリアページもあわせて確認
        </h3>
        <p>
          秋葉原エリア全体のホール一覧とエリア解説は
          <Link
            href="/areas/akihabara"
            className="text-red-600 hover:text-red-700 font-medium"
          >
            秋葉原エリアページ
          </Link>
          から確認できます。複数ホールを回る遠征計画を立てる場合、エリアページでホール同士の位置関係を把握してから、各ホールページで飲食店を比較する流れがおすすめです。秋葉原は改札口（電気街口・昭和通り口・南口）によって飲食動線が変わるため、稼働するホールの最寄り口を基準に候補店を選ぶと、休憩の往復がスムーズになります。
        </p>
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          秋葉原遠征で押さえておきたいジャンル
        </h3>
        <p className="mb-2">
          短時間休憩向けには、丼もの・ラーメン・カレー・そば・うどんが中心です。ガード下には立ち食い系も多く、10〜15分で済ませたい昼休憩に向いています。一方、閉店後にゆっくり食べたい場合は、末広町方面や神田側へ足を延ばす選択肢もあります。
        </p>
        <p>
          パチンコ・パチスロユーザーが秋葉原遠征で満足しやすいのは、「ホールから徒歩圏で完結する」計画と「わざわざ遠出する」計画を時間帯で使い分けている場合です。パチ屋飯の各ホールページでは、期待値飯や時間帯タグを使って候補を絞り込めます。
        </p>
      </div>

      <p className="text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-100">
        関連:
        <Link href="/" className="text-red-600 hover:text-red-700 ml-1">
          ホーム
        </Link>
        <span className="mx-1">·</span>
        <Link href="/guides/expedition-meal" className="text-red-600 hover:text-red-700">
          遠征飯とは
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
