import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { PachinkoHall } from "../../../lib/halls/types"

const directory = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.resolve(directory, "..", "test-fixtures", "minimal-valid")

export async function withFixture<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pachiya-audit-"))
  try {
    await fs.cp(fixtureRoot, root, { recursive: true })
    return await run(root)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

export async function readJson<T>(root: string, relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(root, ...relativePath.split("/")), "utf8")) as T
}

export async function writeJson(root: string, relativePath: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(root, ...relativePath.split("/")), `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

export async function generatedHalls(root: string): Promise<readonly PachinkoHall[]> {
  return readJson<readonly PachinkoHall[]>(root, "generated-halls.json")
}

export function fixedRunOptions(root: string, generated: readonly PachinkoHall[]) {
  return {
    repositoryRoot: root,
    generatedHalls: generated,
    checkedAt: "2026-07-13T00:00:00.000Z",
    now: () => 1_784_304_000_000,
  }
}

export async function exists(value: string): Promise<boolean> {
  try {
    await fs.access(value)
    return true
  } catch {
    return false
  }
}

export function collectStrings(value: unknown): readonly string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings)
  return []
}

export function assertNoUnsafeDiagnosticStrings(value: unknown, repositoryRoot: string, forbidden: readonly string[] = []): void {
  const roots = [repositoryRoot, path.resolve(repositoryRoot), repositoryRoot.replaceAll("\\", "/")]
  for (const text of collectStrings(value)) {
    for (const root of roots) assertDiagnostic(!text.includes(root), "repository path leaked")
    assertDiagnostic(!text.includes("file://"), "file URL leaked")
    assertDiagnostic(!text.includes("Error:"), "error prefix leaked")
    assertDiagnostic(!/^\s*at\s/u.test(text), "stack trace leaked")
    for (const fragment of forbidden) assertDiagnostic(!text.includes(fragment), "exception message leaked")
  }
}

function assertDiagnostic(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
