import path from "node:path"
import { SITE_AUDIT_REPORT_PATH } from "./config"
import { runSiteAudit, type RunSiteAuditOptions, type RunSiteAuditResult } from "./run-site-audit"
import { resolveSiteAuditReportPath, writeSiteAuditReport } from "./write-site-report"

type CliOptions = {
  readonly repositoryRoot?: string
  readonly output: string
  readonly noWrite: boolean
  readonly json: boolean
  readonly help: boolean
}

export type SiteAuditCliDependencies = {
  readonly runSiteAudit?: (options: RunSiteAuditOptions) => Promise<RunSiteAuditResult>
  readonly writeSiteAuditReport?: typeof writeSiteAuditReport
  readonly stdout?: { write(value: string): void }
  readonly stderr?: { write(value: string): void }
  readonly setExitCode?: (value: 0 | 1 | 2) => void
  readonly cwd?: () => string
}

export async function runSiteAuditCli(argv: readonly string[], dependencies: SiteAuditCliDependencies = {}): Promise<void> {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  const setExitCode = dependencies.setExitCode ?? ((value: 0 | 1 | 2) => { process.exitCode = value })
  const run = dependencies.runSiteAudit ?? runSiteAudit
  const write = dependencies.writeSiteAuditReport ?? writeSiteAuditReport
  const cwd = dependencies.cwd ?? process.cwd
  let options: CliOptions
  try {
    options = parseArguments(argv)
  } catch {
    stderr.write("site-audit: 引数を解析できません\n")
    setExitCode(2)
    return
  }
  if (options.help) {
    stdout.write(`${usage()}\n`)
    setExitCode(0)
    return
  }
  const root = path.resolve(options.repositoryRoot ?? cwd())
  try {
    resolveSiteAuditReportPath(root, options.output)
  } catch {
    stderr.write("site-audit: 出力先を検証できません\n")
    setExitCode(2)
    return
  }
  let result: RunSiteAuditResult
  try {
    result = await run({ repositoryRoot: root })
  } catch {
    stderr.write("site-audit: サイト監査を実行できません\n")
    setExitCode(2)
    return
  }
  let reportPath: string | null = null
  if (!options.noWrite) {
    try {
      reportPath = await write(root, result.report, options.output)
    } catch {
      stderr.write("site-audit: サイト監査レポートを書き込めません\n")
      setExitCode(2)
      return
    }
  }
  const summary = {
    status: result.report.status,
    exitCode: result.exitCode,
    publishable: result.report.publishable,
    critical: result.report.summary.critical,
    error: result.report.summary.error,
    warning: result.report.summary.warning,
    info: result.report.summary.info,
    checkedRules: result.report.summary.checkedRules,
    checkedEntities: result.report.summary.checkedEntities,
    reportPath: reportPath ? path.relative(root, reportPath).split(path.sep).join("/") : null,
  }
  stdout.write(options.json
    ? `${JSON.stringify(summary)}\n`
    : [
      `status: ${summary.status}`,
      `exitCode: ${summary.exitCode}`,
      `publishable: ${summary.publishable}`,
      `critical: ${summary.critical}`,
      `error: ${summary.error}`,
      `warning: ${summary.warning}`,
      `info: ${summary.info}`,
      `checkedRules: ${summary.checkedRules}`,
      `checkedEntities: ${summary.checkedEntities}`,
      `reportPath: ${summary.reportPath ?? "(no-write)"}`,
    ].join("\n") + "\n")
  setExitCode(result.exitCode)
}

function parseArguments(argv: readonly string[]): CliOptions {
  let repositoryRoot: string | undefined
  let output = SITE_AUDIT_REPORT_PATH
  let noWrite = false
  let json = false
  let help = false
  let outputSpecified = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--no-write") {
      if (noWrite) throw new Error("--no-writeは一度だけ指定できます")
      noWrite = true
    } else if (argument === "--json") {
      if (json) throw new Error("--jsonは一度だけ指定できます")
      json = true
    } else if (argument === "--help") {
      if (help) throw new Error("--helpは一度だけ指定できます")
      help = true
    } else if (argument === "--repository-root" || argument === "--output") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument}には値が必要です`)
      index += 1
      if (argument === "--repository-root") {
        if (repositoryRoot !== undefined) throw new Error("--repository-rootは一度だけ指定できます")
        repositoryRoot = value
      } else {
        if (outputSpecified) throw new Error("--outputは一度だけ指定できます")
        output = value
        outputSpecified = true
      }
    } else {
      throw new Error(`未対応のオプションです: ${argument}`)
    }
  }
  return { repositoryRoot, output, noWrite, json, help }
}

function usage(): string {
  return [
    "Usage: npx.cmd tsx scripts/audit/site/run-site-audit.ts [options]",
    "  --repository-root <path>  repository root",
    "  --output <relative-path>  report output relative to repository root",
    "  --no-write                do not create a report file",
    "  --json                    write a machine-readable summary to stdout",
    "  --help                    show this help",
  ].join("\n")
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/[\r\n]+/gu, " ") : "CLIを実行できません"
}
