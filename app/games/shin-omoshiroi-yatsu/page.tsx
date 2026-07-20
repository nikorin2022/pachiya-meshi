import type { Metadata } from "next"
import Link from "next/link"
import { StaticPageShell } from "@/components/StaticPageShell"

const PAGE_PATH = "/games/shin-omoshiroi-yatsu"
const PAGE_TITLE = "真のおもしろいやつ風のなにか｜パチ屋飯ミニゲーム"
const PAGE_DESCRIPTION =
  "真のおもしろいやつ風のなにかは、ドラムを回して結果を楽しむパチ屋飯のオリジナルミニゲームです。"

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
  },
  alternates: { canonical: PAGE_PATH },
}

export default function ShinOmoshiroiYatsuPage() {
  return (
    <StaticPageShell title="ミニゲーム" breadcrumbLabel="ミニゲーム">
      <h1 className="text-base sm:text-xl font-bold text-gray-900">
        真のおもしろいやつ風のなにか
      </h1>
      <p>
        「真のおもしろいやつ風のなにか」は、ドラムを回して結果を楽しむオリジナルのミニゲームです。
      </p>

      <div className="-mx-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-950 sm:mx-0">
        <iframe
          src="/embedded-games/shin-omoshiroi-yatsu.html"
          title="真のおもしろいやつ風のなにか ゲーム本体"
          className="block h-[860px] w-full border-0 sm:h-[980px] lg:h-[1040px]"
        />
      </div>

      <div>
        <h2 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          遊び方
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>スタート操作でドラムを回します。</li>
          <li>停止後に結果と獲得ポイント、追加回転数が表示されます。</li>
          <li>総回転数と超ボーナス回数は、累計カウンターをリセットするまで保存されます。</li>
          <li>ゲーム本体の「ゲームをリセット」は、そのゲームの回転数とポイントだけを初期状態に戻します。</li>
        </ul>
      </div>

      <div>
        <h2 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
          注意事項
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>ブラウザの保存データを削除すると、累計記録が消える可能性があります。</li>
          <li>このゲームは娯楽用で、金銭を賭ける機能はありません。</li>
          <li>動作環境によって表示や動作が異なる場合があります。</li>
        </ul>
      </div>

      <p>
        <Link href="/" className="text-red-600 hover:text-red-700 font-medium">
          パチ屋飯トップへ戻る
        </Link>
      </p>
    </StaticPageShell>
  )
}
