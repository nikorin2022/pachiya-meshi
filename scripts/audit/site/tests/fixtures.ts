import type { SiteAuditSnapshot } from "../types"

export const TEST_ORIGIN = "https://www.gameexpect.com"

export function createValidSnapshot(): SiteAuditSnapshot {
  const paths = ["/", "/about", "/areas", "/chains", "/contact", "/guides", "/privacy", "/terms", "/areas/a", "/chains/c", "/guides/g", "/halls/h"]
  return {
    repositoryRoot: "C:/site-audit-fixture",
    origin: TEST_ORIGIN,
    sitemapXml: sitemap(paths),
    renderedRoutes: [...paths, "/search"],
    runtimeRoutes: ["/search", "/robots.txt", "/sitemap.xml"],
    routeTemplates: ["/areas/[areaId]", "/chains/[chainId]", "/halls/[hallId]"],
    expectedSitemapPaths: paths,
    excludedSitemapPaths: ["/search"],
    requiredRoutes: ["/", "/about", "/areas", "/chains", "/contact", "/guides", "/privacy", "/terms", "/robots.txt", "/sitemap.xml", "/search"],
    htmlDocuments: [
      {
        route: "/",
        file: ".next/server/app/index.html",
        html: `<a href="/about">About</a><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", url: `${TEST_ORIGIN}/` })}</script>`,
      },
    ],
    areaIds: ["a"],
    chainIds: ["c"],
    hallIds: ["h"],
    baseline: {
      schemaVersion: "1.0.0",
      recordedAt: "2026-07-14",
      total: 12,
      fixed: 8,
      areas: 1,
      chains: 1,
      halls: 1,
      guides: 1,
      excluded: ["/search"],
    },
  }
}

export function sitemap(paths: readonly string[]): string {
  return `<?xml version="1.0"?><urlset>${paths.map((path) => `<url><loc>${TEST_ORIGIN}${path}</loc></url>`).join("")}</urlset>`
}
