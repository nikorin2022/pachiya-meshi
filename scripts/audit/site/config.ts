export const SITE_AUDIT_SCHEMA_VERSION = "1.0.0" as const
export const SITE_AUDIT_ORIGIN = "https://www.gameexpect.com"
export const SITE_AUDIT_BASELINE_PATH = "scripts/audit/site/site-url-baseline.json"
export const SITE_AUDIT_REPORT_PATH = "artifacts/automation/site-audit-report.json"

export const SITE_AUDIT_RULE_CODES = [
  "SITE_SITEMAP_URL_INVALID",
  "SITE_SITEMAP_URL_DUPLICATE",
  "SITE_SITEMAP_URL_UNKNOWN",
  "SITE_SITEMAP_NOINDEX_INCLUDED",
  "SITE_SITEMAP_REQUIRED_MISSING",
  "SITE_SITEMAP_UNEXPECTED_INCLUDED",
  "SITE_REQUIRED_ROUTE_MISSING",
  "SITE_INTERNAL_LINK_BROKEN",
  "SITE_JSON_LD_INVALID",
  "SITE_JSON_LD_DUPLICATE",
  "SITE_JSON_LD_URL_INVALID",
  "SITE_URL_BASELINE_DRIFT",
] as const

export const SITE_AUDIT_SYSTEM_CODES = [
  "SITE_BUILD_OUTPUT_MISSING",
  "SITE_MANIFEST_INVALID",
  "SITE_BASELINE_INVALID",
  "SITE_SOURCE_DATA_INVALID",
  "SITE_SYSTEM_EXECUTION_FAILURE",
] as const

export const SITE_AUDIT_FIXED_PATHS = [
  "/",
  "/about",
  "/areas",
  "/chains",
  "/contact",
  "/guides",
  "/privacy",
  "/terms",
] as const

export const SITE_AUDIT_NOINDEX_PATHS = ["/search"] as const
export const SITE_AUDIT_REQUIRED_RUNTIME_PATHS = ["/robots.txt", "/sitemap.xml", "/search"] as const

export const SITE_AUDIT_BASELINE_WARNING_DELTA = 2
