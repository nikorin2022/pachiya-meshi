import path from "node:path"
import { pathToFileURL } from "node:url"
import { runAudit, type RunAuditOptions, type RunAuditResult } from "./audit-runner"
import { DEFAULT_AUDIT_REPORT_PATH, resolveAuditReportPath, writeAuditReport } from "./write-report"

type CliOptions = {
  readonly repositoryRoot?: string
  readonly output: string
  readonly noWrite: boolean
  readonly json: boolean
  readonly help: boolean
}

export type AuditCliDependencies = {
  readonly runAudit?: (options: RunAuditOptions) => Promise<RunAuditResult>
  readonly writeAuditReport?: typeof writeAuditReport
  readonly stdout?: { write(value: string): void }
  readonly stderr?: { write(value: string): void }
  readonly setExitCode?: (value: 0 | 1 | 2) => void
  readonly cwd?: () => string
}

/** CLIの公開引数を増やさず、直接実行とテストを同じ本体へ通す。 */
export async function runAuditCli(
  argv: readonly string[],
  dependencies: AuditCliDependencies = {},
): Promise<void> {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  const setExitCode = dependencies.setExitCode ?? ((value: 0 | 1 | 2) => { process.exitCode = value })
  const run = dependencies.runAudit ?? runAudit
  const write = dependencies.writeAuditReport ?? writeAuditReport
  const cwd = dependencies.cwd ?? process.cwd
  let options: CliOptions
  try {
    options = parseArguments(argv)
  } catch (error) {
    writeStderr(stderr, error instanceof Error ? error.message : "CLI引数を解釈できません")
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
    // --no-writeでも危険な出力先指定を受け入れず、CLI入力としてfail closedにする。
    resolveAuditReportPath(root, options.output)
  } catch (error) {
    writeStderr(stderr, error instanceof Error ? error.message : "出力先を解決できません")
    setExitCode(2)
    return
  }

  const result = await run({ repositoryRoot: root })
  let reportPath: string | null = null
  if (!options.noWrite) {
    try {
      resolveAuditReportPath(root, options.output)
      reportPath = await write(root, result.report, options.output)
    } catch (error) {
      writeStderr(stderr, error instanceof Error ? error.message : "監査レポートを書き込めません")
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
    inputHash: result.report.inputHash,
    reportPath: reportPath ? toRepositoryRelativePath(root, reportPath) : null,
  }
  if (options.json) {
    stdout.write(`${JSON.stringify(summary)}\n`)
  } else {
    stdout.write([
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
  setExitCode(result.exitCode)
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

function writeStderr(stderr: { write(value: string): void }, message: string): void {
  stderr.write(`audit: ${message}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runAuditCli(process.argv.slice(2)).catch(() => {
    writeStderr(process.stderr, "予期しないCLIエラーが発生しました")
    process.exitCode = 2
  })
}
