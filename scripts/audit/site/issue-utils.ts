import { createHash } from "node:crypto"
import type { SiteAuditIssue, SiteSeverity } from "./types"

const SEVERITY_RANK: Readonly<Record<SiteSeverity, number>> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
}

export function createSiteAuditIssue(
  code: string,
  severity: SiteSeverity,
  entityType: SiteAuditIssue["entityType"],
  entityId: string | null,
  file: string | null,
  message: string,
  details: Readonly<Record<string, unknown>>,
): SiteAuditIssue {
  const normalizedDetails = canonicalizeSiteIssueDetails(details)
  const identity = JSON.stringify({ code, entityType, entityId, file, details: normalizedDetails })
  return {
    id: createHash("sha256").update(identity).digest("hex"),
    code,
    severity,
    entityType,
    entityId,
    file,
    message,
    details,
  }
}

export function sortSiteAuditIssues(issues: readonly SiteAuditIssue[]): SiteAuditIssue[] {
  const sorted = [...issues].sort(compareSiteAuditIssues)
  const seen = new Set<string>()
  return sorted.filter((issue) => {
    if (seen.has(issue.id)) return false
    seen.add(issue.id)
    return true
  })
}

export function canonicalizeSiteIssueDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeSiteIssueDetails)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort(compareStableStrings).map((key) => [key, canonicalizeSiteIssueDetails(value[key])]))
}

function compareSiteAuditIssues(left: SiteAuditIssue, right: SiteAuditIssue): number {
  return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
    || compareStableStrings(left.code, right.code)
    || compareStableStrings(left.file ?? "", right.file ?? "")
    || compareStableStrings(left.entityId ?? "", right.entityId ?? "")
    || compareStableStrings(left.id, right.id)
}

function compareStableStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
