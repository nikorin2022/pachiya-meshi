import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { checkSiteSnapshot } from "../check-site"
import { collectSiteAuditSnapshot, validateAppPathRoutes } from "../collect-routes"
import { SITE_AUDIT_RULE_CODES, SITE_AUDIT_SYSTEM_CODES } from "../config"
import { runSiteAudit } from "../run-site-audit"
import { runSiteAuditCli } from "../site-cli"
import { SiteAuditLoadError } from "../types"
import { createSiteAuditIssue, sortSiteAuditIssues } from "../issue-utils"
import { resolveSiteAuditReportPath, writeSiteAuditReport, type SiteReportFileOperations } from "../write-site-report"
import { createValidSnapshot, sitemap, TEST_ORIGIN } from "./fixtures"

type Test = { readonly name: string; readonly run: () => Promise<void> | void }
const tests: Test[] = []
const test = (name: string, run: Test["run"]): void => { tests.push({ name, run }) }

test("valid site fixture passes with a deterministic report", async () => {
  const snapshot = createValidSnapshot()
  const first = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot, now: () => new Date("2026-01-01T00:00:00.000Z") })
  const second = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot, now: () => new Date("2026-01-01T00:00:00.000Z") })
  assert.equal(first.exitCode, 0)
  assert.equal(first.report.status, "passed")
  assert.deepEqual({ ...first.report, duration: 0 }, { ...second.report, duration: 0 })
})

test("site issue IDs use the shared semantic contract", () => {
  const base = createSiteAuditIssue("SITE_TEST", "error", "site", "entity", "file.json", "first message", { alpha: 1, nested: { beta: 2, alpha: 1 } })
  const severityChanged = createSiteAuditIssue("SITE_TEST", "warning", "site", "entity", "file.json", "second message", { nested: { alpha: 1, beta: 2 }, alpha: 1 })
  const fileChanged = createSiteAuditIssue("SITE_TEST", "error", "site", "entity", "other.json", "first message", { alpha: 1, nested: { alpha: 1, beta: 2 } })
  assert.equal(base.id, severityChanged.id)
  assert.notEqual(base.id, fileChanged.id)
})

test("site issue sorting follows severity then code file entity ID and is input-order independent", () => {
  const issues = [
    createSiteAuditIssue("B", "info", "site", "a", "a", "", { value: 1 }),
    createSiteAuditIssue("B", "warning", "site", "a", "a", "", { value: 2 }),
    createSiteAuditIssue("B", "error", "site", "a", "a", "", { value: 3 }),
    createSiteAuditIssue("B", "critical", "site", "a", "a", "", { value: 4 }),
    createSiteAuditIssue("A", "critical", "site", "a", "b", "", { value: 5 }),
    createSiteAuditIssue("A", "critical", "site", "z", "a", "", { value: 6 }),
  ]
  const first = sortSiteAuditIssues(issues)
  const second = sortSiteAuditIssues([...issues].reverse())
  assert.deepEqual(first.map((issue) => issue.id), second.map((issue) => issue.id))
  assert.deepEqual(first.map((issue) => issue.severity), ["critical", "critical", "critical", "error", "warning", "info"])
  assert.equal(first[0]?.file, "a")
  assert.equal(first[0]?.entityId, "z")
  assert.equal(first[1]?.file, "b")
  assert.equal(first[1]?.entityId, "a")
})

test("sitemap rejects invalid origin, query, fragment, and trailing slash", () => {
  const snapshot = createValidSnapshot()
  const urls = ["https://example.test/", `${TEST_ORIGIN}/about?x=1`, `${TEST_ORIGIN}/areas/a#x`, `${TEST_ORIGIN}/chains/c/`]
  const result = checkSiteSnapshot({ ...snapshot, sitemapXml: `<urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>` })
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_SITEMAP_URL_INVALID").length, 4)
})

test("sitemap rejects duplicates, noindex paths, and undefined entity IDs", () => {
  const snapshot = createValidSnapshot()
  const result = checkSiteSnapshot({ ...snapshot, sitemapXml: sitemap(["/", "/", "/search", "/areas/missing", "/chains/missing", "/halls/missing"]) })
  assert.ok(result.issues.some((entry) => entry.code === "SITE_SITEMAP_URL_DUPLICATE"))
  assert.ok(result.issues.some((entry) => entry.code === "SITE_SITEMAP_NOINDEX_INCLUDED"))
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_SITEMAP_URL_UNKNOWN").length, 3)
})

test("sitemap compares the complete expected path set and records unexpected reasons", () => {
  const snapshot = createValidSnapshot()
  const missing = checkSiteSnapshot({ ...snapshot, sitemapXml: sitemap(snapshot.expectedSitemapPaths.filter((path) => path !== "/guides/g")) })
  assert.ok(missing.issues.some((entry) => entry.code === "SITE_SITEMAP_REQUIRED_MISSING" && entry.entityId === "/guides/g"))
  const unexpected = checkSiteSnapshot({
    ...snapshot,
    renderedRoutes: [...snapshot.renderedRoutes, "/halls/zero"],
    hallIds: [...snapshot.hallIds, "zero"],
    sitemapXml: sitemap([...snapshot.expectedSitemapPaths, "/halls/zero"]),
  })
  assert.ok(unexpected.issues.some((entry) => entry.code === "SITE_SITEMAP_UNEXPECTED_INCLUDED" && entry.details.reason === "zero_restaurant_hall"))
})

test("required runtime routes are distinct from prerendered routes", () => {
  const snapshot = createValidSnapshot()
  const result = checkSiteSnapshot({ ...snapshot, runtimeRoutes: snapshot.runtimeRoutes.filter((path) => path !== "/robots.txt") })
  assert.ok(result.issues.some((entry) => entry.code === "SITE_REQUIRED_ROUTE_MISSING" && entry.entityId === "/robots.txt"))
})

test("internal links are checked against rendered routes while external and fragments are ignored", () => {
  const snapshot = createValidSnapshot()
  const html = '<a href="/missing">missing</a><a href="/search">search</a><a href="#local">fragment</a><a href="https://example.test/">external</a>'
  const result = checkSiteSnapshot({ ...snapshot, htmlDocuments: [{ route: "/", file: "index.html", html }] })
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_INTERNAL_LINK_BROKEN").length, 1)
})

test("route templates do not make a concrete broken internal link valid", () => {
  const snapshot = createValidSnapshot()
  const result = checkSiteSnapshot({
    ...snapshot,
    hallIds: [...snapshot.hallIds, "not-rendered"],
    htmlDocuments: [{ route: "/", file: "index.html", html: '<a href="/halls/not-rendered">broken</a><a href="/search?q=x">query</a><a href="/about#x">fragment</a>' }],
  })
  assert.ok(result.issues.some((entry) => entry.code === "SITE_INTERNAL_LINK_BROKEN" && entry.entityId === "/halls/not-rendered"))
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_INTERNAL_LINK_BROKEN").length, 1)
})

test("internal links resolve against each document route and only audit the exact current origin", () => {
  const snapshot = createValidSnapshot()
  const html = [
    '<a href="/about">root</a><a href="/search?q=x">query</a><a href="/about#section">fragment</a>',
    '<a href="about">relative</a><a href="../privacy">parent</a><a href="./child">child</a>',
    `<a href="${TEST_ORIGIN}/about">same</a><a href="https://www.gameexpect.com:443/about">default-port</a><a href="http://www.gameexpect.com/about">http</a><a href="//www.gameexpect.com/about">protocol-relative</a><a href="https://www.gameexpect.com.evil.test/about">external</a><a href="//example.test/a">external-protocol-relative</a>`,
    '<a href="mailto:x@example.test">mail</a><a href="tel:1">tel</a><a href="javascript:void(0)">js</a><a href="#x">fragment</a><a href="/%E0%A4%A">bad</a>',
  ].join("")
  const result = checkSiteSnapshot({
    ...snapshot,
    renderedRoutes: [...snapshot.renderedRoutes, "/guides/about", "/guides/child"],
    htmlDocuments: [{ route: "/guides/g", file: "guide.html", html }],
  })
  const broken = result.issues.filter((entry) => entry.code === "SITE_INTERNAL_LINK_BROKEN")
  assert.equal(broken.length, 2)
  assert.deepEqual(broken.map((entry) => entry.details.reason).sort(), ["percent_encoding", "protocol"])
})

test("JSON-LD requires parseable values, identity fields, and canonical site URLs", () => {
  const snapshot = createValidSnapshot()
  const html = [
    '<script type="application/ld+json">not-json</script>',
    '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", url: "https://example.test/a" })}</script>`,
  ].join("")
  const result = checkSiteSnapshot({ ...snapshot, htmlDocuments: [{ route: "/", file: "index.html", html }] })
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_JSON_LD_INVALID").length, 2)
  assert.equal(result.issues.filter((entry) => entry.code === "SITE_JSON_LD_URL_INVALID").length, 1)
})

test("JSON-LD duplicates use canonical object order and validate @id URLs", () => {
  const snapshot = createValidSnapshot()
  const first = JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", "@id": `${TEST_ORIGIN}/` })
  const second = JSON.stringify({ "@type": "WebSite", "@id": `${TEST_ORIGIN}/`, "@context": "https://schema.org" })
  const invalid = JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", "@id": "http://localhost:3000/" })
  const html = `<script type="application/ld+json">${first}</script><script type="application/ld+json">${second}</script><script type="application/ld+json">${invalid}</script>`
  const result = checkSiteSnapshot({ ...snapshot, htmlDocuments: [{ route: "/", file: "index.html", html }] })
  assert.ok(result.issues.some((entry) => entry.code === "SITE_JSON_LD_DUPLICATE"))
  assert.ok(result.issues.some((entry) => entry.code === "SITE_JSON_LD_URL_INVALID"))
})

test("JSON-LD requires identity URLs only for identity types and recursively checks breadcrumb items", () => {
  const snapshot = createValidSnapshot()
  const values = [
    { "@context": "https://schema.org", "@type": "WebPage" },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ item: `${TEST_ORIGIN}/about` }, { item: { "@id": "https://example.test/external" } }] },
    { "@context": "https://schema.org", "@type": "Thing", item: { "@id": `${TEST_ORIGIN}/privacy` } },
  ]
  const html = values.map((value) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`).join("")
  const result = checkSiteSnapshot({ ...snapshot, htmlDocuments: [{ route: "/", file: "index.html", html }] })
  const invalid = result.issues.filter((entry) => entry.code === "SITE_JSON_LD_URL_INVALID")
  assert.equal(invalid.length, 2)
  assert.ok(invalid.some((entry) => entry.details.reason === "missing"))
  assert.ok(invalid.some((entry) => entry.details.reason === "origin"))
})

test("baseline drift is warning for small changes and error for larger changes", () => {
  const snapshot = createValidSnapshot()
  const warning = checkSiteSnapshot({ ...snapshot, sitemapXml: sitemap([...snapshot.expectedSitemapPaths, "/extra"]) })
  assert.equal(warning.issues.find((entry) => entry.code === "SITE_URL_BASELINE_DRIFT")?.severity, "warning")
  const error = checkSiteSnapshot({ ...snapshot, sitemapXml: sitemap([...snapshot.expectedSitemapPaths, "/one", "/two", "/three"]) })
  assert.ok(error.issues.some((entry) => entry.code === "SITE_URL_BASELINE_DRIFT" && entry.severity === "error"))
})

test("missing build output becomes a safe critical report", async () => {
  const result = await runSiteAudit({ repositoryRoot: process.cwd(), collectSnapshot: async () => { throw new SiteAuditLoadError("SITE_BUILD_OUTPUT_MISSING", "private", ".next/prerender-manifest.json") } })
  assert.equal(result.exitCode, 2)
  assert.equal(result.report.summary.critical, 1)
  assert.equal(result.report.issues[0]?.code, "SITE_BUILD_OUTPUT_MISSING")
})

test("only approved SiteAuditLoadError files enter a critical report", async () => {
  const snapshot = createValidSnapshot()
  const loaderCodes = SITE_AUDIT_SYSTEM_CODES.filter((code) => code !== "SITE_SYSTEM_EXECUTION_FAILURE")
  const allowed = ".next/prerender-manifest.json"
  const rejected = ["C:\\Users\\PCuser\\secret.json", "/home/user/secret.json", "\\\\server\\share\\secret.json", "../secret.json", "safe\nsecret.json", "https://example.test/secret"]
  for (const code of loaderCodes) {
    for (const file of [allowed, ...rejected]) {
      const result = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, collectSnapshot: async () => { throw new SiteAuditLoadError(code, "private details C:\\Users\\PCuser\\secret.json", file) } })
      assert.equal(result.exitCode, 2)
      assert.equal(result.report.status, "failed")
      assert.equal(result.report.publishable, false)
      assert.equal(result.report.summary.critical, 1)
      assert.equal(result.report.summary.error, 0)
      assert.equal(result.report.summary.checkedRules, 12)
      assert.equal(result.report.issues[0]?.code, code)
      assert.equal(result.report.issues[0]?.file, file === allowed ? allowed : null)
      assert.ok(!JSON.stringify(result.report).includes("secret.json"))
    }
  }
  const result = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot, checkSnapshot: () => { throw Object.assign(new Error("secret stack /private/path"), { code: "SITE_MANIFEST_INVALID", file: "C:/secret" }) } })
  {
    assert.equal(result.exitCode, 2)
    assert.equal(result.report.status, "failed")
    assert.equal(result.report.publishable, false)
    assert.equal(result.report.summary.critical, 1)
    assert.equal(result.report.summary.error, 0)
    assert.equal(result.report.summary.checkedRules, 12)
    assert.equal(result.report.issues[0]?.code, "SITE_SYSTEM_EXECUTION_FAILURE")
    assert.equal(result.report.issues[0]?.file, null)
    assert.ok(!JSON.stringify(result.report).includes("secret stack"))
  }
})

test("collector execution failures are safe, use collect stage, and differ from checker failures", async () => {
  const snapshot = createValidSnapshot()
  const collect = await runSiteAudit({
    repositoryRoot: snapshot.repositoryRoot,
    collectSnapshot: async () => { throw Object.assign(new Error("secret stack C:\\Users\\PCuser\\secret.json"), { code: "FAKE_SYSTEM_CODE", file: "C:\\Users\\PCuser\\secret.json", stack: "private stack" }) },
  })
  const check = await runSiteAudit({
    repositoryRoot: snapshot.repositoryRoot,
    snapshot,
    checkSnapshot: () => { throw Object.assign(new Error("secret stack C:\\Users\\PCuser\\secret.json"), { code: "FAKE_SYSTEM_CODE", file: "C:\\Users\\PCuser\\secret.json", stack: "private stack" }) },
  })
  for (const result of [collect, check]) {
    assert.equal(result.report.issues[0]?.code, "SITE_SYSTEM_EXECUTION_FAILURE")
    assert.equal(result.report.issues[0]?.file, null)
    assert.equal(result.report.summary.critical, 1)
    assert.equal(result.report.summary.error, 0)
    assert.equal(result.report.status, "failed")
    assert.equal(result.report.publishable, false)
    assert.equal(result.exitCode, 2)
    assert.ok(!JSON.stringify(result.report).includes("secret"))
    assert.ok(!JSON.stringify(result.report).includes("FAKE_SYSTEM_CODE"))
    assert.ok(!JSON.stringify(result.report).includes("private stack"))
  }
  assert.equal(collect.report.issues[0]?.details.stage, "collect")
  assert.equal(check.report.issues[0]?.details.stage, "check")
  assert.notEqual(collect.report.issues[0]?.id, check.report.issues[0]?.id)
  const manifestA = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, collectSnapshot: async () => { throw new SiteAuditLoadError("SITE_MANIFEST_INVALID", "private", ".next/prerender-manifest.json") } })
  const manifestB = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, collectSnapshot: async () => { throw new SiteAuditLoadError("SITE_MANIFEST_INVALID", "private", ".next/app-path-routes-manifest.json") } })
  assert.notEqual(manifestA.report.issues[0]?.id, manifestB.report.issues[0]?.id)
})

test("collector rejects an alternate repository root before mixing source and generated halls", async () => {
  const alternate = await fs.mkdtemp(path.join(os.tmpdir(), "alternate-site-audit-root-"))
  try {
    await assert.rejects(() => collectSiteAuditSnapshot(alternate), (error: unknown) => error instanceof SiteAuditLoadError && error.code === "SITE_SOURCE_DATA_INVALID" && error.file === "data/prefectures")
  } finally {
    await fs.rm(alternate, { recursive: true, force: true })
  }
})

test("app route manifest validation rejects malformed route maps", () => {
  for (const invalid of [null, [], { x: "" }, { x: "about" }, { x: "/halls/[id" }, { x: "/halls/id]" }]) {
    assert.throws(() => validateAppPathRoutes(invalid), (error: unknown) => error instanceof SiteAuditLoadError && error.code === "SITE_MANIFEST_INVALID" && error.file === ".next/app-path-routes-manifest.json")
  }
  assert.doesNotThrow(() => validateAppPathRoutes({ root: "/", hall: "/halls/[id]" }))
})

test("all normal rules have an intentional runtime fixture and no system code leaks", () => {
  const snapshot = createValidSnapshot()
  const emitted = new Set<string>()
  const collect = (value: ReturnType<typeof checkSiteSnapshot>): void => { for (const issue of value.issues) emitted.add(issue.code) }
  collect(checkSiteSnapshot({
    ...snapshot,
    sitemapXml: `<urlset><url><loc>https://example.test/</loc></url><url><loc>${TEST_ORIGIN}/</loc></url><url><loc>${TEST_ORIGIN}/</loc></url><url><loc>${TEST_ORIGIN}/search</loc></url><url><loc>${TEST_ORIGIN}/areas/missing</loc></url><url><loc>${TEST_ORIGIN}/halls/h</loc></url></urlset>`,
    expectedSitemapPaths: ["/", "/about"],
    renderedRoutes: ["/", "/search", "/halls/h"],
    runtimeRoutes: [],
    requiredRoutes: ["/robots.txt"],
    htmlDocuments: [{ route: "/", file: "index.html", html: '<a href="/broken">x</a><script type="application/ld+json">bad</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","url":"https://example.test/"}</script><script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing"}</script><script type="application/ld+json">{"@type":"Thing","@context":"https://schema.org"}</script>' }],
    baseline: { ...snapshot.baseline, total: 99 },
  }))
  assert.deepEqual([...emitted].sort(), [...SITE_AUDIT_RULE_CODES].sort())
  assert.equal([...emitted].filter((code) => SITE_AUDIT_SYSTEM_CODES.includes(code as never)).length, 0)
})

test("reversed snapshot input preserves the semantic report while raw sitemap order may vary", async () => {
  const snapshot = createValidSnapshot()
  const invalid = {
    ...snapshot,
    sitemapXml: sitemap(["/halls/missing", "/areas/missing", "/chains/missing"]),
    renderedRoutes: ["/", ...snapshot.renderedRoutes],
    htmlDocuments: [
      { route: "/z", file: "z.html", html: '<a href="/missing-z">z</a>' },
      { route: "/a", file: "a.html", html: '<a href="/missing-a">a</a>' },
    ],
  }
  const first = await runSiteAudit({ repositoryRoot: invalid.repositoryRoot, snapshot: invalid, now: () => new Date("2026-01-01T00:00:00.000Z") })
  const reversedSitemap = `<urlset>${[...invalid.sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]).reverse().map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`
  const reversed = {
    ...invalid,
    sitemapXml: reversedSitemap,
    renderedRoutes: [...invalid.renderedRoutes].reverse(),
    runtimeRoutes: [...invalid.runtimeRoutes].reverse(),
    routeTemplates: [...invalid.routeTemplates].reverse(),
    expectedSitemapPaths: [...invalid.expectedSitemapPaths].reverse(),
    excludedSitemapPaths: [...invalid.excludedSitemapPaths].reverse(),
    requiredRoutes: [...invalid.requiredRoutes].reverse(),
    htmlDocuments: [...invalid.htmlDocuments].reverse(),
    areaIds: [...invalid.areaIds].reverse(),
    chainIds: [...invalid.chainIds].reverse(),
    hallIds: [...invalid.hallIds].reverse(),
  }
  const second = await runSiteAudit({ repositoryRoot: reversed.repositoryRoot, snapshot: reversed, now: () => new Date("2026-01-01T00:00:00.000Z") })
  assert.deepEqual(first.report.issues.map((entry) => entry.id), second.report.issues.map((entry) => entry.id))
  assert.deepEqual(first.report.summary, second.report.summary)
  assert.equal(first.report.status, second.report.status)
  assert.equal(first.report.publishable, second.report.publishable)
  assert.equal(first.exitCode, second.exitCode)
  assert.equal(first.report.summary.checkedEntities, second.report.summary.checkedEntities)
  assert.deepEqual([...first.report.sitemapUrls].sort(), [...second.report.sitemapUrls].sort())
})

test("CLI supports no-write JSON and rejects unsafe output", async () => {
  const snapshot = createValidSnapshot()
  const result = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot })
  const stdout: string[] = []
  const stderr: string[] = []
  const exitCodes: number[] = []
  let writes = 0
  await runSiteAuditCli(["--no-write", "--json"], {
    cwd: () => snapshot.repositoryRoot,
    runSiteAudit: async () => result,
    writeSiteAuditReport: async () => { writes += 1; return "unused" },
    stdout: { write: (value) => { stdout.push(value) } },
    stderr: { write: (value) => { stderr.push(value) } },
    setExitCode: (value) => { exitCodes.push(value) },
  })
  assert.equal(writes, 0)
  assert.deepEqual(JSON.parse(stdout.join("")), { status: "passed", exitCode: 0, publishable: true, critical: 0, error: 0, warning: 0, info: 0, checkedRules: 12, checkedEntities: 26, reportPath: null })
  await runSiteAuditCli(["--output", "C:\\unsafe.json"], { cwd: () => snapshot.repositoryRoot, stderr: { write: (value) => { stderr.push(value) } }, setExitCode: (value) => { exitCodes.push(value) } })
  assert.ok(stderr.join("").includes("出力先を検証できません"))
  assert.deepEqual(exitCodes, [0, 2])
})

test("CLI covers help, exit classes, invalid flags, and never leaks dependency errors", async () => {
  const snapshot = createValidSnapshot()
  const normal = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot })
  const error = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot: { ...snapshot, htmlDocuments: [{ route: "/", file: "index.html", html: '<a href="/missing">x</a>' }] } })
  const critical = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, collectSnapshot: async () => { throw new SiteAuditLoadError("SITE_MANIFEST_INVALID", "private", ".next/app-path-routes-manifest.json") } })
  const stdout: string[] = []
  const stderr: string[] = []
  const exits: number[] = []
  const common = { cwd: () => snapshot.repositoryRoot, stdout: { write: (value: string) => { stdout.push(value) } }, stderr: { write: (value: string) => { stderr.push(value) } }, setExitCode: (value: 0 | 1 | 2) => { exits.push(value) } }
  await runSiteAuditCli(["--help"], common)
  assert.equal(exits.at(-1), 0)
  assert.ok(stdout.join("").includes("Usage:"))
  for (const argv of [["--unknown"], ["--output"], ["--output", "a", "--output", "b"], ["--repository-root"], ["--repository-root", "a", "--repository-root", "b"], ["--json", "--json"], ["--no-write", "--no-write"], ["--help", "--help"], ["--output", "C:\\outside.json"], ["--output", "\\\\server\\share\\outside.json"], ["--output", "../outside.json"], ["--output", "..\\outside.json"], ["--output", "."], ["--output", "report\ninjected.json"], ["--output", "report\ttab.json"], ["--output", "report\u007fdel.json"]]) {
    await runSiteAuditCli(argv, common)
    assert.equal(exits.at(-1), 2)
  }
  for (const [result, expectedExit] of [[normal, 0], [error, 1], [critical, 2]] as const) {
    await runSiteAuditCli(["--no-write"], { ...common, runSiteAudit: async () => result })
    assert.equal(exits.at(-1), expectedExit)
  }
  await runSiteAuditCli(["--no-write"], { ...common, runSiteAudit: async () => { throw new Error("private failure at C:\\Users\\PCuser\\secret.json") } })
  await runSiteAuditCli([], { ...common, runSiteAudit: async () => normal, writeSiteAuditReport: async () => { throw new Error("private failure at C:\\Users\\PCuser\\secret.json") } })
  assert.ok(stderr.some((value) => value.includes("引数を解析できません")))
  assert.ok(stderr.some((value) => value.includes("出力先を検証できません")))
  assert.ok(stderr.some((value) => value.includes("サイト監査を実行できません")))
  assert.ok(stderr.some((value) => value.includes("サイト監査レポートを書き込めません")))
  assert.ok(!stderr.join("").includes("secret.json"))
})

test("site report is formatted JSON and stays within the requested temporary directory", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "site-audit-report-"))
  try {
    const snapshot = createValidSnapshot()
    const result = await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot })
    const reportPath = await writeSiteAuditReport(directory, result.report, "report.json")
    const text = await fs.readFile(reportPath, "utf8")
    assert.equal(text.endsWith("\n"), true)
    assert.deepEqual(JSON.parse(text), result.report)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("site report writer supports Windows fallback and restores the old report on replacement failure", async () => {
  const snapshot = createValidSnapshot()
  const report = (await runSiteAudit({ repositoryRoot: snapshot.repositoryRoot, snapshot })).report
  const run = async (failReplacement: boolean): Promise<Map<string, string>> => {
    const files = new Map<string, string>()
    const target = path.resolve("C:/site-audit-writer", "report.json")
    files.set(target, "old")
    let temporaryToTarget = 0
    const operations = {
      mkdir: async () => undefined,
      writeFile: async (file: any, value: any) => { files.set(String(file), String(value)) },
      rename: async (from: any, to: any) => {
        const source = String(from)
        const destination = String(to)
        if (source.includes(".tmp") && destination === target) {
          temporaryToTarget += 1
          if (temporaryToTarget === 1) throw errno("EPERM")
          if (failReplacement) throw errno("EIO")
        }
        const value = files.get(source)
        if (value === undefined) throw errno("ENOENT")
        files.set(destination, value)
        files.delete(source)
      },
      rm: async (file: any) => { files.delete(String(file)) },
    } as unknown as SiteReportFileOperations
    if (failReplacement) {
      await assert.rejects(() => writeSiteAuditReport("C:/site-audit-writer", report, "report.json", { fileOperations: operations, createToken: () => "token" }), /置換|書き出せません/u)
      assert.equal(files.get(target), "old")
    } else {
      await writeSiteAuditReport("C:/site-audit-writer", report, "report.json", { fileOperations: operations, createToken: () => "token" })
      assert.deepEqual(JSON.parse(files.get(target) ?? ""), report)
    }
    assert.equal([...files.keys()].some((file) => file.includes(".tmp") || file.includes(".bak")), false)
    return files
  }
  await run(false)
  await run(true)
})

test("site report writer rejects unsafe tokens and output paths before filesystem writes", async () => {
  const report = (await runSiteAudit({ repositoryRoot: "C:/fixture", snapshot: createValidSnapshot() })).report
  let writes = 0
  const operations = {
    mkdir: async () => { writes += 1 },
    writeFile: async () => { writes += 1 },
    rename: async () => { writes += 1 },
    rm: async () => { writes += 1 },
  } as unknown as SiteReportFileOperations
  for (const token of ["", ".", "x".repeat(129), "../unsafe", "..\\unsafe", "token\nchild", "token\\child", "token/child", "日本語"]) {
    await assert.rejects(() => writeSiteAuditReport("C:/fixture", report, "report.json", { fileOperations: operations, createToken: () => token }))
  }
  assert.equal(writes, 0)
  for (const output of ["/root.json", "C:\\root.json", "C:/root.json", "\\server\\share\\x.json", "\\\\server\\share\\x.json", "//server/share/x.json", "../outside.json", "..\\outside.json", "nested/../../outside.json", "nested\\..\\..\\outside.json", "."]) {
    assert.throws(() => resolveSiteAuditReportPath("C:/fixture", output))
  }
  for (const output of ["artifacts/automation/report\ninjected.json", "artifacts/automation/report\ttab.json", "artifacts/automation/report\u007fdel.json"]) {
    await assert.rejects(() => writeSiteAuditReport("C:/fixture", report, output, { fileOperations: operations, createToken: () => "safe" }))
  }
  assert.equal(writes, 0)
})

test("site report writer keeps a primary failure when cleanup also fails", async () => {
  const report = (await runSiteAudit({ repositoryRoot: "C:/fixture", snapshot: createValidSnapshot() })).report
  const operations = {
    mkdir: async () => undefined,
    writeFile: async () => { throw new Error("private write failure") },
    rename: async () => undefined,
    rm: async () => { throw new Error("private cleanup failure") },
  } as unknown as SiteReportFileOperations
  await assert.rejects(
    () => writeSiteAuditReport("C:/fixture", report, "report.json", { fileOperations: operations, createToken: () => "safe" }),
    (error: unknown) => error instanceof Error && !error.message.includes("private") && !error.message.includes("cleanup"),
  )
})

test("site report writer preserves the backup if rollback restoration fails and reports cleanup failures safely", async () => {
  const report = (await runSiteAudit({ repositoryRoot: "C:/fixture", snapshot: createValidSnapshot() })).report
  const target = path.resolve("C:/fixture", "report.json")
  const files = new Map<string, string>([[target, "old"]])
  let temporaryToTarget = 0
  const rollbackOperations = {
    mkdir: async () => undefined,
    writeFile: async (file: any, value: any) => { files.set(String(file), String(value)) },
    rename: async (from: any, to: any) => {
      const source = String(from); const destination = String(to)
      if (source.includes(".tmp") && destination === target) { temporaryToTarget += 1; throw errno(temporaryToTarget === 1 ? "EPERM" : "EIO") }
      if (source.includes(".bak") && destination === target) throw errno("EIO")
      const value = files.get(source); if (value === undefined) throw errno("ENOENT")
      files.set(destination, value); files.delete(source)
    },
    rm: async (file: any) => { files.delete(String(file)) },
  } as unknown as SiteReportFileOperations
  await assert.rejects(() => writeSiteAuditReport("C:/fixture", report, "report.json", { fileOperations: rollbackOperations, createToken: () => "rollback" }))
  assert.equal(files.get(target), undefined)
  assert.ok([...files.keys()].some((file) => file.includes(".bak")))

  const cleanupOperations = {
    mkdir: async () => undefined,
    writeFile: async () => undefined,
    rename: async () => undefined,
    rm: async () => { throw new Error("private cleanup failure") },
  } as unknown as SiteReportFileOperations
  await assert.rejects(
    () => writeSiteAuditReport("C:/fixture", report, "report.json", { fileOperations: cleanupOperations, createToken: () => "cleanup" }),
    (error: unknown) => error instanceof Error && !error.message.includes("private"),
  )
})

function errno(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code })
}

void (async () => {
  let passed = 0
  for (const entry of tests) {
    try {
      await entry.run()
      passed += 1
      process.stdout.write(`PASS ${entry.name}\n`)
    } catch (error) {
      process.stderr.write(`FAIL ${entry.name}\n${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    }
  }
  const failed = tests.length - passed
  process.stdout.write(`RESULT passed=${passed} failed=${failed}\n`)
  process.exitCode = failed === 0 ? 0 : 1
})().catch(() => {
  process.stderr.write("FAIL test runner setup failed\n")
  process.exitCode = 1
})
