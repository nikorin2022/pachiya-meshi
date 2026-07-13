import {
  SITE_AUDIT_BASELINE_WARNING_DELTA,
  SITE_AUDIT_FIXED_PATHS,
  SITE_AUDIT_NOINDEX_PATHS,
  SITE_AUDIT_ORIGIN,
} from "./config"
import type { SiteAuditIssue, SiteAuditSnapshot, SiteSeverity } from "./types"
import { canonicalizeSiteIssueDetails, createSiteAuditIssue, sortSiteAuditIssues } from "./issue-utils"

export function checkSiteSnapshot(snapshot: SiteAuditSnapshot): { readonly issues: SiteAuditIssue[]; readonly sitemapUrls: string[] } {
  const issues: SiteAuditIssue[] = []
  const sitemapUrls = parseSitemapUrls(snapshot.sitemapXml)
  const canonicalPaths = new Map<string, string>()

  for (const rawUrl of sitemapUrls) {
    const checked = validateCanonicalSiteUrl(rawUrl, snapshot.origin)
    if (!checked.ok) {
      issues.push(issue("SITE_SITEMAP_URL_INVALID", "error", "sitemap", rawUrl, null, "sitemap URLがcanonical形式ではありません", { url: rawUrl, reason: checked.reason }))
      continue
    }
    const duplicate = canonicalPaths.get(checked.path)
    if (duplicate) {
      issues.push(issue("SITE_SITEMAP_URL_DUPLICATE", "error", "sitemap", checked.path, null, "sitemap URLが重複しています", { first: duplicate, duplicate: rawUrl }))
      continue
    }
    canonicalPaths.set(checked.path, rawUrl)
    if (snapshot.excludedSitemapPaths.includes(checked.path)) {
      issues.push(issue("SITE_SITEMAP_NOINDEX_INCLUDED", "error", "sitemap", checked.path, null, "noindexページがsitemapに含まれています", { path: checked.path }))
    }
    if (!isDefinedEntityPath(checked.path, snapshot) || !snapshot.renderedRoutes.includes(checked.path)) {
      issues.push(issue("SITE_SITEMAP_URL_UNKNOWN", "error", "sitemap", checked.path, null, "sitemap URLに対応する生成済みページがありません", { path: checked.path }))
    }
  }

  const actualPaths = [...canonicalPaths.keys()]
  for (const path of snapshot.expectedSitemapPaths) {
    if (!canonicalPaths.has(path)) {
      issues.push(issue("SITE_SITEMAP_REQUIRED_MISSING", "error", "sitemap", path, null, "必須sitemap URLがありません", { path }))
    }
  }
  for (const path of actualPaths) {
    if (!snapshot.expectedSitemapPaths.includes(path)) {
      issues.push(issue("SITE_SITEMAP_UNEXPECTED_INCLUDED", "error", "sitemap", path, null, "想定外のURLがsitemapに含まれています", { path, reason: unexpectedReason(path, snapshot) }))
    }
  }
  for (const path of snapshot.requiredRoutes) {
    if (!snapshot.renderedRoutes.includes(path) && !snapshot.runtimeRoutes.includes(path)) {
      issues.push(issue("SITE_REQUIRED_ROUTE_MISSING", "error", "route", path, null, "必須runtime routeがbuild成果物にありません", { path }))
    }
  }

  issues.push(...checkInternalLinks(snapshot))
  issues.push(...checkJsonLd(snapshot))
  issues.push(...checkBaseline(actualPaths, snapshot))
  return { issues: sortSiteAuditIssues(issues), sitemapUrls }
}

export function parseSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => decodeXml(match[1].trim()))
}

function checkInternalLinks(snapshot: SiteAuditSnapshot): SiteAuditIssue[] {
  const issues: SiteAuditIssue[] = []
  for (const document of snapshot.htmlDocuments) {
    for (const href of extractHrefValues(document.html)) {
      const target = parseInternalHref(href, snapshot.origin, document.route)
      if (!target.internal) continue
      if (!target.ok || !isKnownRoute(target.path, snapshot)) {
        issues.push(issue("SITE_INTERNAL_LINK_BROKEN", "error", "link", target.path, document.file, "内部リンクの遷移先ページがありません", { href, route: document.route, path: target.path, reason: target.ok ? "unknown_route" : target.reason }))
      }
    }
  }
  return issues
}

function checkJsonLd(snapshot: SiteAuditSnapshot): SiteAuditIssue[] {
  const issues: SiteAuditIssue[] = []
  for (const document of snapshot.htmlDocuments) {
    const seen = new Set<string>()
    for (const value of extractJsonLdValues(document.html)) {
      let parsed: unknown
      try {
        parsed = JSON.parse(value)
      } catch {
        issues.push(issue("SITE_JSON_LD_INVALID", "error", "json_ld", document.route, document.file, "JSON-LDをJSONとして解析できません", { route: document.route, reason: "parse" }))
        continue
      }
      const fingerprint = JSON.stringify(canonicalizeSiteIssueDetails(parsed))
      if (seen.has(fingerprint)) {
        issues.push(issue("SITE_JSON_LD_DUPLICATE", "warning", "json_ld", document.route, document.file, "同一のJSON-LDが同じページに重複しています", { route: document.route }))
        continue
      }
      seen.add(fingerprint)
      if (!isRecord(parsed) || !hasJsonLdIdentity(parsed)) {
        issues.push(issue("SITE_JSON_LD_INVALID", "error", "json_ld", document.route, document.file, "JSON-LDに必須の@contextまたは@typeがありません", { route: document.route, reason: "identity" }))
        continue
      }
      const candidates = collectJsonLdUrls(parsed)
      if (requiresIdentityUrl(parsed) && !hasRootIdentityUrl(parsed)) {
        issues.push(issue("SITE_JSON_LD_URL_INVALID", "error", "json_ld", document.route, document.file, "JSON-LDの識別URLがありません", { route: document.route, key: "identity", reason: "missing" }))
      }
      for (const candidate of candidates) {
        const checked = typeof candidate.value === "string" ? validateCanonicalSiteUrl(candidate.value, snapshot.origin) : { ok: false as const, path: "", reason: "non_string" }
        if (!checked.ok || !isKnownRoute(checked.path, snapshot)) {
          issues.push(issue("SITE_JSON_LD_URL_INVALID", "error", "json_ld", document.route, document.file, "JSON-LDのサイトURLが不正です", { route: document.route, key: candidate.key, url: candidate.value, reason: checked.ok ? "unknown_route" : checked.reason }))
        }
      }
    }
  }
  return issues
}

function checkBaseline(paths: readonly string[], snapshot: SiteAuditSnapshot): SiteAuditIssue[] {
  const actual = {
    total: paths.length,
    fixed: paths.filter((path) => SITE_AUDIT_FIXED_PATHS.includes(path as never)).length,
    areas: paths.filter((path) => /^\/areas\/[^/]+$/u.test(path)).length,
    chains: paths.filter((path) => /^\/chains\/[^/]+$/u.test(path)).length,
    halls: paths.filter((path) => /^\/halls\/[^/]+$/u.test(path)).length,
    guides: paths.filter((path) => /^\/guides\/[^/]+$/u.test(path)).length,
  }
  const issues: SiteAuditIssue[] = []
  for (const key of Object.keys(actual) as Array<keyof typeof actual>) {
    const expected = snapshot.baseline[key]
    const delta = actual[key] - expected
    if (delta === 0) continue
    const severity: SiteSeverity = Math.abs(delta) > SITE_AUDIT_BASELINE_WARNING_DELTA ? "error" : "warning"
    issues.push(issue("SITE_URL_BASELINE_DRIFT", severity, "baseline", key, "scripts/audit/site/site-url-baseline.json", "site URL baselineとの差分があります", { category: key, expected, actual: actual[key], delta }))
  }
  return issues
}

function validateCanonicalSiteUrl(value: string, origin: string): { readonly ok: true; readonly path: string } | { readonly ok: false; readonly reason: string; readonly path: string } {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, reason: "parse", path: "" }
  }
  if (url.protocol !== "https:") return { ok: false, reason: "protocol", path: url.pathname }
  if (url.origin !== origin || origin !== SITE_AUDIT_ORIGIN) return { ok: false, reason: "origin", path: url.pathname }
  if (url.search || url.hash) return { ok: false, reason: "query_or_fragment", path: url.pathname }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) return { ok: false, reason: "trailing_slash", path: url.pathname }
  if (url.pathname !== url.pathname.toLowerCase()) return { ok: false, reason: "uppercase", path: url.pathname }
  return { ok: true, path: url.pathname }
}

function parseInternalHref(href: string, origin: string, documentRoute: string): { readonly internal: boolean; readonly ok: boolean; readonly path: string; readonly reason: string } {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return { internal: false, ok: true, path: "", reason: "ignored" }
  let url: URL
  try {
    url = new URL(href, new URL(documentRoute, origin))
  } catch {
    return { internal: true, ok: false, path: "", reason: "parse" }
  }
  const expected = new URL(origin)
  // Classify by exact hostname and normalized port, not a string prefix. This
  // keeps same-host HTTP links inside the audit so their protocol is rejected.
  if (url.hostname !== expected.hostname || url.port !== expected.port) return { internal: false, ok: true, path: "", reason: "external" }
  if (url.protocol !== "https:") return { internal: true, ok: false, path: url.pathname, reason: "protocol" }
  try { decodeURIComponent(url.pathname) } catch { return { internal: true, ok: false, path: url.pathname, reason: "percent_encoding" } }
  return { internal: true, ok: true, path: url.pathname, reason: "" }
}

function isKnownRoute(path: string, snapshot: SiteAuditSnapshot): boolean {
  return snapshot.renderedRoutes.includes(path) || snapshot.runtimeRoutes.includes(path)
}

function isDefinedEntityPath(path: string, snapshot: SiteAuditSnapshot): boolean {
  const match = path.match(/^\/(areas|chains|halls)\/([^/]+)$/u)
  if (!match) return true
  const [, kind, id] = match
  if (kind === "areas") return snapshot.areaIds.includes(id)
  if (kind === "chains") return snapshot.chainIds.includes(id)
  return snapshot.hallIds.includes(id)
}

function extractHrefValues(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/giu)].map((match) => decodeXml(match[1]))
}

function extractJsonLdValues(html: string): string[] {
  return [...html.matchAll(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/giu)].map((match) => match[1].trim())
}

function hasJsonLdIdentity(value: Record<string, unknown>): boolean {
  const context = value["@context"]
  const type = value["@type"]
  return typeof context === "string" && context === "https://schema.org" && (typeof type === "string" && type.length > 0 || Array.isArray(type) && type.length > 0 && type.every((entry) => typeof entry === "string" && entry.length > 0))
}

type JsonLdUrlCandidate = { readonly key: string; readonly value: unknown; readonly identity: boolean }

function requiresIdentityUrl(value: Record<string, unknown>): boolean {
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]]
  return types.some((type) => typeof type === "string" && (type === "WebSite" || type === "WebPage" || type === "Article" || type === "Restaurant" || type === "LocalBusiness" || type.endsWith("Business")))
}

function hasRootIdentityUrl(value: Record<string, unknown>): boolean {
  return typeof value.url === "string" || typeof value["@id"] === "string"
}

function collectJsonLdUrls(value: unknown, key = "", identity = false): JsonLdUrlCandidate[] {
  if (Array.isArray(value)) return value.flatMap((entry) => collectJsonLdUrls(entry, key, identity))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([entryKey, entryValue]) => {
    if (entryKey === "item" && (isRecord(entryValue) || Array.isArray(entryValue))) return collectJsonLdUrls(entryValue, entryKey)
    const own = entryKey === "url" || entryKey === "item" || entryKey === "@id"
      ? [{ key: entryKey, value: entryValue, identity: identity || entryKey === "url" || entryKey === "@id" }]
      : []
    return [...own, ...collectJsonLdUrls(entryValue, entryKey, identity || entryKey === "url" || entryKey === "@id")]
  })
}

function unexpectedReason(path: string, snapshot: SiteAuditSnapshot): string {
  const hall = path.match(/^\/halls\/([^/]+)$/u)
  if (hall) return snapshot.hallIds.includes(hall[1]) ? "zero_restaurant_hall" : "unknown_hall"
  if (/^\/areas\/[^/]+$/u.test(path)) return "unexpected_area"
  if (/^\/chains\/[^/]+$/u.test(path)) return "unexpected_chain"
  if (/^\/guides\/[^/]+$/u.test(path)) return "unexpected_guide"
  return "unexpected_path"
}

const issue = createSiteAuditIssue

function decodeXml(value: string): string {
  return value.replace(/&amp;/gu, "&").replace(/&quot;/gu, "\"").replace(/&#x27;/gu, "'")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
