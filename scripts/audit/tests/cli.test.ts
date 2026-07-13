import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs/promises"
import path from "node:path"
import { assert, test } from "./test-harness"
import { fixedRunOptions, generatedHalls, readJson, withFixture, writeJson } from "./fixture-utils"
import { runAudit } from "../audit-runner"
import { runAuditCli } from "../run-audit"

const execFileAsync = promisify(execFile)
const runner = "scripts/audit/run-audit.ts"
const tsxCli = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs")

async function cli(root: string, args: readonly string[]) {
  try {
    return await execFileAsync(process.execPath, [tsxCli, runner, "--repository-root", root, ...args], {
      cwd: path.resolve(process.cwd()),
      windowsHide: true,
    })
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; code?: number }
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.code ?? -1 }
  }
}

test("CLI help and no-write JSON have clean machine-readable output", async () => {
  const help = await cli(process.cwd(), ["--help"])
  assert.equal((help as { code?: number }).code ?? 0, 0)
  assert.match((help as { stdout: string }).stdout, /Usage:/u)
  assert.equal((help as { stderr: string }).stderr, "")
  const result = await cli(process.cwd(), ["--no-write", "--json"])
  const summary = JSON.parse((result as { stdout: string }).stdout)
  assert.equal(summary.exitCode, 0)
  assert.equal(summary.reportPath, null)
  assert.equal(summary.warning, 53)
})

test("CLI rejects unsafe arguments and reports normal and critical fixture outcomes", async () => {
  await withFixture(async (root) => {
    for (const args of [
      ["--unknown"], ["--output"], ["--repository-root"], ["--json", "--json"],
      ["--no-write", "--no-write"], ["--help", "--help"], ["--output", path.resolve("absolute.json")],
      ["--output", "../outside.json"], ["--output", "C:\\outside.json"], ["--output", "."],
      ["--output", "first.json", "--output", "second.json"], ["--repository-root", root],
    ]) {
      const result = await cli(root, args)
      assert.equal((result as { code: number }).code, 2)
      assert.equal((result as { stdout: string }).stdout, "")
      assert.match((result as { stderr: string }).stderr, /^audit: /u)
    }
    const artifactDirectory = path.join(root, "artifacts")
    assert.equal(await fs.stat(artifactDirectory).then(() => true).catch(() => false), false)
    const missingRoot = path.join(root, "missing-repository-root")
    const missingRootResult = await cli(missingRoot, ["--no-write", "--json"])
    assert.equal((missingRootResult as { code: number }).code, 2)
    assert.equal(JSON.parse((missingRootResult as { stdout: string }).stdout).critical, 1)
    assert.equal(await fs.stat(missingRoot).then(() => true).catch(() => false), false)
  })
  await withFixture(async (root) => {
    const restaurants = await readJson<Array<Record<string, unknown>>>(root, "data/prefectures/tokyo/restaurants.json")
    restaurants[0].address = "https://invalid.example/restaurant"
    await writeJson(root, "data/prefectures/tokyo/restaurants.json", restaurants)
    const error = await cli(root, ["--no-write", "--json"])
    assert.equal((error as { code: number }).code, 1)
    assert.ok(JSON.parse((error as { stdout: string }).stdout).error >= 1)
  })
  await withFixture(async (root) => {
    await fs.rm(path.join(root, "data", "areas.json"))
    const critical = await cli(root, ["--no-write", "--json"])
    assert.equal((critical as { code: number }).code, 2)
    assert.equal(JSON.parse((critical as { stdout: string }).stdout).critical, 1)
  })
})

test("in-process CLI fixture injects its generated halls and leaves no-write output absent", async () => {
  await withFixture(async (root) => {
    const restaurants = await readJson<Array<Record<string, unknown>>>(root, "data/prefectures/tokyo/restaurants.json")
    restaurants[0].address = "https://invalid.example/restaurant"
    await writeJson(root, "data/prefectures/tokyo/restaurants.json", restaurants)
    const generated = await generatedHalls(root)
    let stdout = ""
    let stderr = ""
    let exitCode: number | undefined
    await runAuditCli(["--repository-root", root, "--no-write", "--output", "missing/report.json", "--json"], {
      runAudit: (options) => runAudit({ ...options, ...fixedRunOptions(root, generated) }),
      stdout: { write: (value) => { stdout += value } },
      stderr: { write: (value) => { stderr += value } },
      setExitCode: (value) => { exitCode = value },
    })
    const summary = JSON.parse(stdout)
    assert.equal(exitCode, 1)
    assert.equal(stderr, "")
    assert.equal(summary.status, "failed")
    assert.equal(summary.publishable, false)
    assert.equal(summary.critical, 0)
    assert.equal(summary.reportPath, null)
    assert.ok((await runAudit({ ...fixedRunOptions(root, generated) })).report.issues.some((issue) => issue.code === "RESTAURANT_ADDRESS_MISSING"))
    assert.equal(await fs.stat(path.join(root, "missing")).then(() => true).catch(() => false), false)
  })
})
