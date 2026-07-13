import path from "node:path"
import { runAudit } from "./audit-runner"
import { DEFAULT_AUDIT_REPORT_PATH, resolveAuditReportPath, writeAuditReport } from "./write-report"

type CliOptions = {
  readonly repositoryRoot?: string
  readonly output: string
  readonly noWrite: boolean
  readonly json: boolean
  readonly help: boolean
}

async function main(argv: readonly string[]): Promise<void> {
  let options: CliOptions
  try {
    options = parseArguments(argv)
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : "CLI引数を解釈できません")
    process.exitCode = 2
    return
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    process.exitCode = 0
    return
  }

  const root = path.resolve(options.repositoryRoot ?? process.cwd())
  try {
    // --no-writeでも危険な出力先指定を受け入れず、CLI入力としてfail closedにする。
    resolveAuditReportPath(root, options.output)
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : "出力先を解決できません")
    process.exitCode = 2
    return
  }

  const result = await runAudit({ repositoryRoot: root })
  let reportPath: string | null = null
  if (!options.noWrite) {
    try {
      resolveAuditReportPath(root, options.output)
      reportPath = await writeAuditReport(root, result.report, options.output)
    } catch (error) {
      writeStderr(error instanceof Error ? error.message : "監査レポートを書き込めません")
      process.exitCode = 2
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
    inputHash: result.report.inputHash,
    reportPath: reportPath ? toRepositoryRelativePath(root, reportPath) : null,
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
    process.stdout.write([
      `status: ${summary.status}`,
      `exitCode: ${summary.exitCode}`,
      `publishable: ${summary.publishable}`,
      `critical: ${summary.critical}`,
      `error: ${summary.error}`,
      `warning: ${summary.warning}`,
      `info: ${summary.info}`,
      `checkedRules: ${summary.checkedRules}`,
      `checkedEntities: ${summary.checkedEntities}`,
      `inputHash: ${summary.inputHash}`,
      `reportPath: ${summary.reportPath ?? "(no-write)"}`,
    ].join("\n") + "\n")
  }
  process.exitCode = result.exitCode
}

function parseArguments(argv: readonly string[]): CliOptions {
  let repositoryRoot: string | undefined
  let output = DEFAULT_AUDIT_REPORT_PATH
  let noWrite = false
  let json = false
  let help = false
  let outputSpecified = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--no-write") {
      if (noWrite) throw new Error("--no-write は一度だけ指定してください")
      noWrite = true
    } else if (argument === "--json") {
      if (json) throw new Error("--json は一度だけ指定してください")
      json = true
    } else if (argument === "--help") {
      if (help) throw new Error("--help は一度だけ指定してください")
      help = true
    } else if (argument === "--repository-root" || argument === "--output") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument} には値が必要です`)
      index += 1
      if (argument === "--repository-root") {
        if (repositoryRoot !== undefined) throw new Error("--repository-root は一度だけ指定してください")
        repositoryRoot = value
      } else {
        if (outputSpecified) throw new Error("--output は一度だけ指定してください")
        output = value
        outputSpecified = true
      }
    } else {
      throw new Error(`未知のオプションです: ${argument}`)
    }
  }
  return { repositoryRoot, output, noWrite, json, help }
}

function toRepositoryRelativePath(repositoryRoot: string, reportPath: string): string {
  return path.relative(repositoryRoot, reportPath).split(path.sep).join("/")
}

function usage(): string {
  return [
    "Usage: npx.cmd tsx scripts/audit/run-audit.ts [options]",
    "  --repository-root <path>  監査対象のrepository root",
    "  --output <relative-path>  repository root基準のJSON出力先",
    "  --no-write                レポートファイルを書き込まない",
    "  --json                    stdoutをJSON要約だけにする",
    "  --help                    この使い方を表示する",
  ].join("\n")
}

function writeStderr(message: string): void {
  process.stderr.write(`audit: ${message}\n`)
}

void main(process.argv.slice(2)).catch(() => {
  writeStderr("予期しないCLIエラーが発生しました")
  process.exitCode = 2
})
