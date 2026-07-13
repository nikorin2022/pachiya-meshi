export type SiteSeverity = "critical" | "error" | "warning" | "info"
export type SiteAuditStatus = "passed" | "passed_with_warnings" | "failed"

export type SiteAuditIssue = {
  readonly id: string
  readonly code: string
  readonly severity: SiteSeverity
  readonly entityType: "site" | "sitemap" | "route" | "link" | "json_ld" | "baseline"
  readonly entityId: string | null
  readonly file: string | null
  readonly message: string
  readonly details: Readonly<Record<string, unknown>>
}

export type SiteUrlBaseline = {
  readonly schemaVersion: "1.0.0"
  readonly recordedAt: string
  readonly total: number
  readonly fixed: number
  readonly areas: number
  readonly chains: number
  readonly halls: number
  readonly guides: number
  readonly excluded: readonly string[]
}

export type SiteHtmlDocument = {
  readonly route: string
  readonly file: string
  readonly html: string
}

export type SiteAuditSnapshot = {
  readonly repositoryRoot: string
  readonly origin: string
  readonly sitemapXml: string
  readonly renderedRoutes: readonly string[]
  /** app-path-routes manifestに現れる、動的templateを除いた実行時route */
  readonly runtimeRoutes: readonly string[]
  readonly routeTemplates: readonly string[]
  readonly expectedSitemapPaths: readonly string[]
  readonly excludedSitemapPaths: readonly string[]
  readonly requiredRoutes: readonly string[]
  readonly htmlDocuments: readonly SiteHtmlDocument[]
  readonly areaIds: readonly string[]
  readonly chainIds: readonly string[]
  readonly hallIds: readonly string[]
  readonly baseline: SiteUrlBaseline
}

export type SiteAuditSummary = {
  readonly checkedEntities: number
  readonly checkedRules: number
  readonly critical: number
  readonly error: number
  readonly warning: number
  readonly info: number
}

export type SiteAuditReport = {
  readonly schemaVersion: "1.0.0"
  readonly status: SiteAuditStatus
  readonly publishable: boolean
  readonly checkedAt: string
  readonly duration: number
  readonly summary: SiteAuditSummary
  readonly criticalErrors: number
  readonly errors: number
  readonly warnings: number
  readonly info: number
  readonly issues: readonly SiteAuditIssue[]
  readonly checkedRoutes: readonly string[]
  readonly sitemapUrls: readonly string[]
}

export class SiteAuditLoadError extends Error {
  constructor(
    readonly code: "SITE_BUILD_OUTPUT_MISSING" | "SITE_MANIFEST_INVALID" | "SITE_BASELINE_INVALID" | "SITE_SOURCE_DATA_INVALID",
    message: string,
    readonly file: string | null = null,
  ) {
    super(message)
    this.name = "SiteAuditLoadError"
  }
}
