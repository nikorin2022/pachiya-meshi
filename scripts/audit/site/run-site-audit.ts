import { pathToFileURL } from "node:url"
import { SITE_AUDIT_RULE_CODES, SITE_AUDIT_SCHEMA_VERSION, SITE_AUDIT_SYSTEM_CODES } from "./config"
import { checkSiteSnapshot } from "./check-site"
import { collectSiteAuditSnapshot } from "./collect-routes"
import { runSiteAuditCli } from "./site-cli"
import { createSiteAuditIssue } from "./issue-utils"
import { SiteAuditLoadError, type SiteAuditIssue, type SiteAuditReport, type SiteAuditSnapshot } from "./types"

export type RunSiteAuditOptions = {
  readonly repositoryRoot: string
  readonly snapshot?: SiteAuditSnapshot
  readonly now?: () => Date
  readonly collectSnapshot?: (repositoryRoot: string) => Promise<SiteAuditSnapshot>
  readonly checkSnapshot?: typeof checkSiteSnapshot
}

export type RunSiteAuditResult = {
  readonly report: SiteAuditReport
  readonly exitCode: 0 | 1 | 2
}

export async function runSiteAudit(options: RunSiteAuditOptions): Promise<RunSiteAuditResult> {
  const started = Date.now()
  const now = options.now ?? (() => new Date())
  const collectSnapshot = options.collectSnapshot ?? collectSiteAuditSnapshot
  const checkSnapshot = options.checkSnapshot ?? checkSiteSnapshot
  let stage: "collect" | "check" = "collect"
  try {
    const snapshot = options.snapshot ?? await collectSnapshot(options.repositoryRoot)
    stage = "check"
    const checked = checkSnapshot(snapshot)
    return finalize(snapshot, checked.issues, checked.sitemapUrls, now, Date.now() - started)
  } catch (error) {
    const loadError = error instanceof SiteAuditLoadError ? error : null
    const code = loadError && SITE_AUDIT_SYSTEM_CODES.includes(loadError.code as never) ? loadError.code : "SITE_SYSTEM_EXECUTION_FAILURE"
    const issue: SiteAuditIssue = createSiteAuditIssue(
      code,
      "critical",
      "site",
      null,
      loadError ? safeLoadErrorFile(loadError.file) : null,
      "サイト監査の入力を安全に読み取れません",
      { stage },
    )
    return finalize(null, [issue], [], now, Date.now() - started)
  }
}

function safeLoadErrorFile(file: string | null): string | null {
  if (!file) return null
  if ([
    ".next/prerender-manifest.json",
    ".next/app-path-routes-manifest.json",
    ".next/server/app/sitemap.xml.body",
    ".next/server/app",
    "scripts/audit/site/site-url-baseline.json",
    "data/prefectures",
  ].includes(file)) return file
  if (/^data\/prefectures\/[a-z0-9]+(?:-[a-z0-9]+)*\/halls\.json$/u.test(file)) return file
  return null
}

function finalize(snapshot: SiteAuditSnapshot | null, issues: readonly SiteAuditIssue[], sitemapUrls: readonly string[], now: () => Date, duration: number): RunSiteAuditResult {
  const counts = { critical: 0, error: 0, warning: 0, info: 0 }
  for (const entry of issues) counts[entry.severity] += 1
  const status = counts.critical > 0 || counts.error > 0 ? "failed" : counts.warning > 0 ? "passed_with_warnings" : "passed"
  const report: SiteAuditReport = {
    schemaVersion: SITE_AUDIT_SCHEMA_VERSION,
    status,
    publishable: counts.critical === 0 && counts.error === 0,
    checkedAt: now().toISOString(),
    duration,
    summary: {
      checkedEntities: snapshot ? snapshot.renderedRoutes.length + snapshot.htmlDocuments.length + sitemapUrls.length : 0,
      checkedRules: SITE_AUDIT_RULE_CODES.length,
      ...counts,
    },
    criticalErrors: counts.critical,
    errors: counts.error,
    warnings: counts.warning,
    info: counts.info,
    issues,
    checkedRoutes: snapshot?.renderedRoutes ?? [],
    sitemapUrls,
  }
  return { report, exitCode: counts.critical > 0 ? 2 : counts.error > 0 ? 1 : 0 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runSiteAuditCli(process.argv.slice(2)).catch(() => {
    process.stderr.write("site-audit: CLIを実行できませんでした\n")
    process.exitCode = 2
  })
}
