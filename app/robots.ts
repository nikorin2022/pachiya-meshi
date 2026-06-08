import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

/**
 * robots.txt を Next.js App Router の規約で動的生成する。
 * `/robots.txt` でアクセス可能。
 *
 * 全クローラに対して全ページの巡回を許可し、sitemap.xml の場所を伝える。
 * 個別の noindex 制御はページの metadata 側 (`robots: { index: false }`) で行う。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
