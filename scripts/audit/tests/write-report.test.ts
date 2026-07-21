import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { runAudit } from "../audit-runner"
import { resolveAuditReportPath, writeAuditReport, type AuditReportFileOperations } from "../write-report"
import { assert, test } from "./test-harness"
import { assertNoUnsafeDiagnosticStrings, exists, fixedRunOptions, generatedHalls, withFixture } from "./fixture-utils"

function fileError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code })
}

test("writeAuditReport creates formatted JSON and replaces it without temporary files", async () => {
  await withFixture(async (fixtureRoot) => {
    const report = (await runAudit(fixedRunOptions(fixtureRoot, await generatedHalls(fixtureRoot)))).report
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pachiya-report-"))
    try {
      const output = "nested/report.json"
      const target = await writeAuditReport(root, report, output)
      const first = await fs.readFile(target, "utf8")
      assert.equal(JSON.parse(first).inputHash, report.inputHash)
      assert.ok(first.startsWith("{\n  \"schemaVersion\""))
      assert.ok(first.endsWith("\n"))
      await writeAuditReport(root, report, output)
      const names = await fs.readdir(path.dirname(target))
      assert.equal(names.some((name) => name.endsWith(".tmp") || name.endsWith(".bak")), false)
      await assert.rejects(() => writeAuditReport(root, report, "../outside.json"))
      await assert.rejects(() => writeAuditReport(root, report, path.resolve(root, "absolute.json")))
      await assert.rejects(() => writeAuditReport(root, report, "."))
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

test("writeAuditReport supports Windows fallback and restores old content on replacement failure", async () => {
  await withFixture(async (fixtureRoot) => {
    const report = (await runAudit(fixedRunOptions(fixtureRoot, await generatedHalls(fixtureRoot)))).report
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pachiya-report-"))
    const output = "report.json"
    const target = path.join(root, output)
    try {
      await fs.writeFile(target, "old-report\n", "utf8")
      let directRename = true
      const fallbackOperations: AuditReportFileOperations = {
        ...fs,
        rename: async (from, to) => {
          if (directRename && String(from).endsWith(".tmp") && String(to) === target) {
            directRename = false
            throw fileError("EEXIST")
          }
          return fs.rename(from, to)
        },
      }
      await writeAuditReport(root, report, output, { fileOperations: fallbackOperations, createToken: () => "fallback" })
      assert.equal(JSON.parse(await fs.readFile(target, "utf8")).inputHash, report.inputHash)
      assert.equal(await exists(path.join(root, ".report.json.fallback.bak")), false)

      await fs.writeFile(target, "old-report\n", "utf8")
      let temporaryRenameAttempts = 0
      const rollbackOperations: AuditReportFileOperations = {
        ...fs,
        rename: async (from, to) => {
          if (String(from).endsWith(".tmp") && String(to) === target) {
            temporaryRenameAttempts += 1
            throw fileError(temporaryRenameAttempts === 1 ? "EEXIST" : "EACCES")
          }
          return fs.rename(from, to)
        },
      }
      await assert.rejects(() => writeAuditReport(root, report, output, { fileOperations: rollbackOperations, createToken: () => "rollback" }))
      assert.equal(await fs.readFile(target, "utf8"), "old-report\n")
      assert.equal(await exists(path.join(root, ".report.json.rollback.tmp")), false)
      assert.equal(await exists(path.join(root, ".report.json.rollback.bak")), false)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

test("writeAuditReport keeps cleanup failures safe and does not hide the primary failure", async () => {
  await withFixture(async (fixtureRoot) => {
    const report = (await runAudit(fixedRunOptions(fixtureRoot, await generatedHalls(fixtureRoot)))).report
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pachiya-report-"))
    const target = path.join(root, "report.json")
    try {
      const temporaryCleanupFailure: AuditReportFileOperations = {
        ...fs,
        rm: async (value, options) => {
          if (String(value).endsWith(".tmp")) throw fileError("raw temporary cleanup failure")
          return fs.rm(value, options)
        },
      }
      await assert.rejects(
        () => writeAuditReport(root, report, "report.json", { fileOperations: temporaryCleanupFailure, createToken: () => "temporary-cleanup" }),
        (error: unknown) => {
          assert.equal((error as Error).message, "監査レポートの一時ファイルを安全に削除できません")
          assertNoUnsafeDiagnosticStrings((error as Error).message, root, ["raw temporary cleanup failure"])
          return true
        },
      )
      assert.equal(JSON.parse(await fs.readFile(target, "utf8")).inputHash, report.inputHash)

      let directRename = true
      const backupCleanupFailure: AuditReportFileOperations = {
        ...fs,
        rename: async (from, to) => {
          if (directRename && String(from).endsWith(".tmp") && String(to) === target) {
            directRename = false
            throw fileError("EEXIST")
          }
          return fs.rename(from, to)
        },
        rm: async (value, options) => {
          if (String(value).endsWith(".bak")) throw fileError("raw backup cleanup failure")
          return fs.rm(value, options)
        },
      }
      await assert.rejects(
        () => writeAuditReport(root, report, "report.json", { fileOperations: backupCleanupFailure, createToken: () => "backup-cleanup" }),
        (error: unknown) => {
          assert.equal((error as Error).message, "置換後の監査レポートbackupを削除できません")
          assertNoUnsafeDiagnosticStrings((error as Error).message, root, ["raw backup cleanup failure"])
          return true
        },
      )
      assert.equal(JSON.parse(await fs.readFile(target, "utf8")).inputHash, report.inputHash)
      assert.equal(await exists(path.join(root, ".report.json.backup-cleanup.bak")), true)

      await fs.writeFile(target, "old-report\n", "utf8")
      let temporaryTargetAttempts = 0
      const unrecoverableRollback: AuditReportFileOperations = {
        ...fs,
        rename: async (from, to) => {
          if (String(from).endsWith(".tmp") && String(to) === target) {
            temporaryTargetAttempts += 1
            throw fileError(temporaryTargetAttempts === 1 ? "EEXIST" : "EACCES")
          }
          if (String(from).endsWith(".bak") && String(to) === target) throw fileError("raw rollback failure")
          return fs.rename(from, to)
        },
      }
      await assert.rejects(
        () => writeAuditReport(root, report, "report.json", { fileOperations: unrecoverableRollback, createToken: () => "rollback-recovery" }),
        (error: unknown) => {
          assert.equal((error as Error).message, "監査レポートの置換に失敗し、既存レポートを復元できません")
          assertNoUnsafeDiagnosticStrings((error as Error).message, root, ["raw rollback failure"])
          return true
        },
      )
      const backup = path.join(root, ".report.json.rollback-recovery.bak")
      assert.equal(await fs.readFile(backup, "utf8"), "old-report\n")
      assert.equal(await exists(path.join(root, ".report.json.rollback-recovery.tmp")), false)

      await fs.rename(backup, target)
      let primaryAttempts = 0
      const primaryWithCleanupFailure: AuditReportFileOperations = {
        ...fs,
        rename: async (from, to) => {
          if (String(from).endsWith(".tmp") && String(to) === target) {
            primaryAttempts += 1
            throw fileError(primaryAttempts === 1 ? "EEXIST" : "EACCES")
          }
          return fs.rename(from, to)
        },
        rm: async (value, options) => {
          if (String(value).endsWith(".tmp")) throw fileError("raw cleanup after primary")
          return fs.rm(value, options)
        },
      }
      await assert.rejects(
        () => writeAuditReport(root, report, "report.json", { fileOperations: primaryWithCleanupFailure, createToken: () => "primary-cleanup" }),
        (error: unknown) => {
          assert.equal((error as Error).message, "監査レポートを置換できません")
          assertNoUnsafeDiagnosticStrings((error as Error).message, root, ["raw cleanup after primary"])
          return true
        },
      )
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

test("writeAuditReport rejects unsafe temporary tokens before filesystem writes", async () => {
  await withFixture(async (fixtureRoot) => {
    const report = (await runAudit(fixedRunOptions(fixtureRoot, await generatedHalls(fixtureRoot)))).report
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "pachiya-report-"))
    try {
      for (const token of ["", "../outside", "..\\outside", "/absolute", "C:\\outside", "with space", "token\nchild", "日本語", "a".repeat(129), "token/child"]) {
        await assert.rejects(
          () => writeAuditReport(root, report, "report.json", { createToken: () => token }),
          (error: unknown) => {
            assert.equal((error as Error).message, "監査レポートの一時ファイル識別子が不正です")
            assertNoUnsafeDiagnosticStrings((error as Error).message, root, token ? [token] : [])
            return true
          },
        )
      }
      assert.equal(await exists(path.join(root, "report.json")), false)
      assert.equal((await fs.readdir(root)).some((name) => name.endsWith(".tmp") || name.endsWith(".bak")), false)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

test("resolveAuditReportPath rejects POSIX, Windows, and UNC absolute paths on every OS", () => {
  const root = path.resolve("audit-root")
  for (const output of ["/outside.json", "C:\\outside.json", "C:/outside.json", "\\\\server\\share\\outside.json", "//server/share/outside.json"]) {
    assert.throws(() => resolveAuditReportPath(root, output))
  }
  assert.equal(resolveAuditReportPath(root, "artifacts/automation/report.json"), path.join(root, "artifacts", "automation", "report.json"))
  assert.equal(resolveAuditReportPath(root, "nested/report.json"), path.join(root, "nested", "report.json"))
})
