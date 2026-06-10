import type { MetadataRoute } from "next"
import { getAreaIdsWithHalls } from "@/lib/areas"
import { getChainIdsWithHalls } from "@/lib/chains"
import { getAllHalls } from "@/lib/halls"
import { SITE_URL } from "@/lib/seo"

/**
 * sitemap.xml を Next.js App Router の規約で動的生成する。
 * `/sitemap.xml` でアクセス可能。
 *
 * 登録ホール (`lib/halls/index.ts`) を全件列挙するため、新ホール追加時に
 * 自動的に sitemap へ反映される。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const topPage: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1.0,
  }

  const areasIndexPage: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/areas`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }

  const chainsIndexPage: MetadataRoute.Sitemap[number] = {
    url: `${SITE_URL}/chains`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }

  const staticPages: MetadataRoute.Sitemap = [
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }))

  const areaPages: MetadataRoute.Sitemap = getAreaIdsWithHalls().map((areaId) => ({
    url: `${SITE_URL}/areas/${areaId}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85,
  }))

  const chainPages: MetadataRoute.Sitemap = getChainIdsWithHalls().map(
    (chainId) => ({
      url: `${SITE_URL}/chains/${chainId}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    }),
  )

  const hallPages: MetadataRoute.Sitemap = getAllHalls().map((hall) => ({
    url: `${SITE_URL}/halls/${hall.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [
    topPage,
    areasIndexPage,
    chainsIndexPage,
    ...staticPages,
    ...areaPages,
    ...chainPages,
    ...hallPages,
  ]
}
