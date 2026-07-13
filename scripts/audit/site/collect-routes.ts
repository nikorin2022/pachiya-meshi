import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { getAllHalls } from "../../../lib/halls"
import { GUIDE_PAGE_PATHS } from "../../../lib/guides"
import { SITE_AUDIT_BASELINE_PATH, SITE_AUDIT_FIXED_PATHS, SITE_AUDIT_NOINDEX_PATHS, SITE_AUDIT_ORIGIN, SITE_AUDIT_REQUIRED_RUNTIME_PATHS } from "./config"
import { SiteAuditLoadError, type SiteAuditSnapshot, type SiteHtmlDocument, type SiteUrlBaseline } from "./types"

type PrerenderManifest = { readonly routes?: Record<string, unknown> }
type AppPathRoutesManifest = Record<string, string>
const SOURCE_REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

export async function collectSiteAuditSnapshot(repositoryRoot: string): Promise<SiteAuditSnapshot> {
  const root = await assertRepositoryRoot(repositoryRoot)
  const [prerenderManifest, appPathRoutes, sitemapXml, baseline, sourceHalls, htmlDocuments] = await Promise.all([
    readJson<PrerenderManifest>(root, ".next/prerender-manifest.json", "SITE_BUILD_OUTPUT_MISSING"),
    readJson<AppPathRoutesManifest>(root, ".next/app-path-routes-manifest.json", "SITE_BUILD_OUTPUT_MISSING"),
    readText(root, ".next/server/app/sitemap.xml.body", "SITE_BUILD_OUTPUT_MISSING"),
    readJson<SiteUrlBaseline>(root, SITE_AUDIT_BASELINE_PATH, "SITE_BASELINE_INVALID"),
    readSourceHalls(root),
    collectHtmlDocuments(root),
  ])

  if (!prerenderManifest.routes || !isRecord(prerenderManifest.routes)) {
    throw new SiteAuditLoadError("SITE_MANIFEST_INVALID", "prerender manifestにroutesがありません", ".next/prerender-manifest.json")
  }
  validateAppPathRoutes(appPathRoutes)
  validateBaseline(baseline)
  const activeHallIds = new Set(getAllHalls().filter((hall) => hall.restaurants.length > 0).map((hall) => hall.id))
  const activeSourceHalls = sourceHalls.filter((hall) => activeHallIds.has(hall.id))
  // Taxonomy pages remain expected even when a source hall has no restaurants.
  const areaIds = unique(sourceHalls.map((hall) => hall.areaId))
  const chainIds = unique(sourceHalls.map((hall) => hall.chainId).filter((id): id is string => id !== null))
  const hallIds = unique(sourceHalls.map((hall) => hall.id))
  const expectedSitemapPaths = unique([
    ...SITE_AUDIT_FIXED_PATHS,
    ...areaIds.map((id) => `/areas/${id}`),
    ...chainIds.map((id) => `/chains/${id}`),
    ...activeSourceHalls.map((hall) => `/halls/${hall.id}`),
    ...GUIDE_PAGE_PATHS,
  ])
  const routeValues = Object.values(appPathRoutes)

  return {
    repositoryRoot: root,
    origin: SITE_AUDIT_ORIGIN,
    sitemapXml,
    renderedRoutes: Object.keys(prerenderManifest.routes).sort(),
    runtimeRoutes: unique(routeValues.filter((route) => !route.includes("["))),
    routeTemplates: unique(routeValues.filter((route) => route.includes("["))),
    expectedSitemapPaths,
    excludedSitemapPaths: [...SITE_AUDIT_NOINDEX_PATHS],
    requiredRoutes: unique([...SITE_AUDIT_FIXED_PATHS, ...SITE_AUDIT_REQUIRED_RUNTIME_PATHS]),
    htmlDocuments,
    areaIds,
    chainIds,
    hallIds,
    baseline,
  }
}

async function assertRepositoryRoot(repositoryRoot: string): Promise<string> {
  try {
    const [requested, source] = await Promise.all([fs.realpath(path.resolve(repositoryRoot)), fs.realpath(SOURCE_REPOSITORY_ROOT)])
    const normalize = (value: string): string => process.platform === "win32" ? value.toLocaleLowerCase("en-US") : value
    if (normalize(requested) !== normalize(source)) throw new Error("repository roots differ")
    return requested
  } catch {
    throw new SiteAuditLoadError("SITE_SOURCE_DATA_INVALID", "repository root does not match the generated halls source", "data/prefectures")
  }
}

export function validateAppPathRoutes(value: unknown): asserts value is AppPathRoutesManifest {
  if (!isPlainObject(value)) invalidManifest()
  for (const [key, route] of Object.entries(value)) {
    if (!key || typeof route !== "string" || route.length === 0 || !route.startsWith("/") || !hasBalancedBrackets(route)) invalidManifest()
  }
}

function invalidManifest(): never {
  throw new SiteAuditLoadError("SITE_MANIFEST_INVALID", "app path routes manifest is not a valid route map", ".next/app-path-routes-manifest.json")
}

function hasBalancedBrackets(value: string): boolean {
  let depth = 0
  for (const character of value) {
    if (character === "[") depth += 1
    if (character === "]") {
      depth -= 1
      if (depth < 0) return false
    }
  }
  return depth === 0
}

async function readJson<T>(root: string, relativePath: string, missingCode: SiteAuditLoadError["code"]): Promise<T> {
  const file = path.join(root, relativePath)
  let text: string
  try {
    text = await fs.readFile(file, "utf8")
  } catch {
    throw new SiteAuditLoadError(missingCode, "必要な監査入力ファイルを読み取れません", relativePath)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new SiteAuditLoadError(missingCode === "SITE_BUILD_OUTPUT_MISSING" ? "SITE_MANIFEST_INVALID" : missingCode, "監査入力JSONを解析できません", relativePath)
  }
}

async function readText(root: string, relativePath: string, missingCode: SiteAuditLoadError["code"]): Promise<string> {
  try {
    return await fs.readFile(path.join(root, relativePath), "utf8")
  } catch {
    throw new SiteAuditLoadError(missingCode, "必要な監査入力ファイルを読み取れません", relativePath)
  }
}

type SourceHall = { readonly id: string; readonly areaId: string; readonly chainId: string | null }

async function readSourceHalls(root: string): Promise<SourceHall[]> {
  const dataDirectory = path.join(root, "data/prefectures")
  let prefectures: string[]
  try {
    prefectures = (await fs.readdir(dataDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch {
    throw new SiteAuditLoadError("SITE_SOURCE_DATA_INVALID", "prefecture data directoryを読み取れません", "data/prefectures")
  }
  const batches = await Promise.all(prefectures.map(async (prefecture) => {
    const relative = `data/prefectures/${prefecture}/halls.json`
    const value = await readJson<unknown>(root, relative, "SITE_SOURCE_DATA_INVALID")
    if (!Array.isArray(value) || value.some((entry) => !isRecord(entry) || typeof entry.id !== "string" || typeof entry.area_id !== "string" || (entry.chain_id !== undefined && entry.chain_id !== null && typeof entry.chain_id !== "string"))) {
      throw new SiteAuditLoadError("SITE_SOURCE_DATA_INVALID", "hall sitemap入力を読み取れません", relative)
    }
    return value.map((entry) => ({ id: String((entry as { id: string }).id), areaId: String((entry as { area_id: string }).area_id), chainId: (entry as { chain_id?: string | null }).chain_id ?? null }))
  }))
  return batches.flat().sort((left, right) => left.id.localeCompare(right.id))
}

async function collectHtmlDocuments(root: string): Promise<SiteHtmlDocument[]> {
  const directory = path.join(root, ".next/server/app")
  const files = await walk(directory)
  const htmlFiles = files.filter((file) => file.endsWith(".html")).sort()
  if (htmlFiles.length === 0) {
    throw new SiteAuditLoadError("SITE_BUILD_OUTPUT_MISSING", "静的HTML成果物がありません", ".next/server/app")
  }
  return Promise.all(htmlFiles.map(async (file) => ({
    route: htmlFileToRoute(path.relative(directory, file)),
    file: path.relative(root, file).split(path.sep).join("/"),
    html: await fs.readFile(file, "utf8"),
  })))
}

async function walk(directory: string): Promise<string[]> {
  let entries: Array<{ readonly name: string; isDirectory(): boolean }>
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch {
    throw new SiteAuditLoadError("SITE_BUILD_OUTPUT_MISSING", "静的HTML成果物を読み取れません", ".next/server/app")
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  }))
  return nested.flat()
}

function htmlFileToRoute(relativeFile: string): string {
  const normalized = relativeFile.split(path.sep).join("/")
  if (normalized === "index.html") return "/"
  return `/${normalized.slice(0, -".html".length)}`
}

function validateBaseline(value: SiteUrlBaseline): void {
  if (!isRecord(value)) throw new SiteAuditLoadError("SITE_BASELINE_INVALID", "site URL baselineの形式が不正です", SITE_AUDIT_BASELINE_PATH)
  const numbers = [value.total, value.fixed, value.areas, value.chains, value.halls, value.guides]
  const excluded = value.excluded
  if (value.schemaVersion !== "1.0.0" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.recordedAt) || !Array.isArray(excluded) || excluded.some((entry) => typeof entry !== "string") || new Set(excluded).size !== excluded.length || numbers.some((number) => !Number.isInteger(number) || number < 0) || value.total !== value.fixed + value.areas + value.chains + value.halls + value.guides || [...excluded].sort().join("\u0000") !== [...SITE_AUDIT_NOINDEX_PATHS].sort().join("\u0000")) {
    throw new SiteAuditLoadError("SITE_BASELINE_INVALID", "site URL baselineの形式が不正です", SITE_AUDIT_BASELINE_PATH)
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
