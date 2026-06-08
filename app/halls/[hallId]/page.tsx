import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllHallIds, getHallById } from "@/lib/halls"
import { JsonLd, buildHallBreadcrumbJsonLd } from "@/lib/seo"
import HallDetailClient from "./HallDetailClient"

type Params = { hallId: string }

/**
 * SSG: 登録済みホールの ID 全件分のページをビルド時に静的生成する。
 * 新しいホールが `lib/halls/index.ts` に追加されると自動的に増える。
 */
export function generateStaticParams() {
  return getAllHallIds().map((hallId) => ({ hallId }))
}

/**
 * SEO metadata。ホール名 / エリア / 都道府県名を反映して
 * 各ホールページに固有のタイトル・ディスクリプションを設定する。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { hallId } = await params
  const hall = getHallById(hallId)

  if (!hall) {
    return {
      title: "ホールが見つかりません | パチンコ飯ナビ",
      description: "指定されたパチンコホールは登録されていません。",
      robots: { index: false, follow: false },
    }
  }

  const title = `${hall.name} 周辺の飲食店ガイド | パチンコ飯ナビ`
  const description = `${hall.prefecture}${hall.city}のパチンコホール「${hall.name}」から徒歩10分以内で行ける飲食店を、朝飯/昼飯/夜飯やジャンル別にまとめたガイド。`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "ja_JP",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `/halls/${hall.id}`,
    },
  }
}

export default async function HallPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { hallId } = await params
  const hall = getHallById(hallId)

  if (!hall) {
    notFound()
  }

  return (
    <>
      {/* SEO: BreadcrumbList 構造化データ（ホーム → ホール詳細） */}
      <JsonLd data={buildHallBreadcrumbJsonLd(hall)} />
      <HallDetailClient hall={hall} />
    </>
  )
}
