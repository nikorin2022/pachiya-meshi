// diff-halls: dump-halls の出力と _generated/index.ts の getAllHalls() を比較
//
// 用途:
//   Phase C で「生成データが既存と一致しているか」を確認。
//   差分があれば walk-minutes/ai-summary overrides で潰していく。
//
// 使い方:
//   npm run dump:halls
//   npm run generate:halls
//   npm run diff:halls
//   npm run diff:halls -- halls-legacy.json
//
// 終了コード:
//   0  差分なし
//   2  差分あり (最大 50 件まで表示)
//   1  ファイル不在等の致命エラー

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

async function main() {
  const args = process.argv.slice(2)
  const legacyArg = args[0] ?? "halls-legacy.json"

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(scriptsDir, "..")
  const legacyPath = path.isAbsolute(legacyArg)
    ? legacyArg
    : path.join(projectRoot, legacyArg)

  let legacyRaw: string
  try {
    legacyRaw = await fs.readFile(legacyPath, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        `[diff-halls] legacy snapshot がありません: ${legacyPath}\n  先に npm run dump:halls を実行してください。`,
      )
      process.exit(1)
    }
    throw err
  }
  const legacy = JSON.parse(legacyRaw)

  const generatedIndex = path.join(
    projectRoot,
    "lib",
    "halls",
    "_generated",
    "index.ts",
  )
  let generatedModule: { getAllHalls: () => unknown[] }
  try {
    // Windows 絶対パスは file:// URL に変換 (Node ESM 仕様)
    generatedModule = await import(pathToFileURL(generatedIndex).href)
  } catch (err) {
    console.error(
      `[diff-halls] _generated/index.ts を読み込めません。\n  先に npm run generate:halls を実行してください。`,
    )
    console.error(err)
    process.exit(1)
  }
  const generated = generatedModule.getAllHalls()

  const diffs = deepDiff(legacy, generated, "halls")
  if (diffs.length === 0) {
    console.log("[diff-halls] OK: legacy と生成データに差分なし")
    return
  }

  console.log(`[diff-halls] DIFF: ${diffs.length} 件`)
  const shown = diffs.slice(0, 50)
  for (const d of shown) console.log(`  ${d}`)
  if (diffs.length > shown.length) {
    console.log(`  ... (${diffs.length - shown.length} more)`)
  }
  process.exit(2)
}

function deepDiff(a: unknown, b: unknown, p: string): string[] {
  if (a === b) return []
  if (typeof a !== typeof b) {
    return [`${p}: type mismatch (${typeof a} vs ${typeof b})`]
  }
  if (a === null || b === null) {
    if (a !== b) {
      return [`${p}: null mismatch (${JSON.stringify(a)} vs ${JSON.stringify(b)})`]
    }
    return []
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return [`${p}: array vs non-array`]

    // restaurants 配列は順不同で比較する (生成側は walkMinutes 昇順、
    // legacy 側は id 昇順なので、id でソートしてから比べる)。
    let arrA = a
    let arrB = b as unknown[]
    if (p.endsWith(".restaurants")) {
      arrA = [...a].sort(byNumericId)
      arrB = [...arrB].sort(byNumericId)
    }

    if (arrA.length !== arrB.length) {
      const idsA = arrA.map(itemKey).join(",")
      const idsB = arrB.map(itemKey).join(",")
      return [
        `${p}: length mismatch (legacy=${arrA.length}[${idsA}] vs generated=${arrB.length}[${idsB}])`,
      ]
    }
    const result: string[] = []
    for (let i = 0; i < arrA.length; i++) {
      const subKey = p.endsWith(".restaurants")
        ? `${p}[id=${itemKey(arrA[i])}]`
        : `${p}[${i}]`
      result.push(...deepDiff(arrA[i], arrB[i], subKey))
    }
    return result
  }
  if (typeof a === "object" && a !== null) {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const keysA = Object.keys(ao).sort()
    const keysB = Object.keys(bo).sort()
    if (keysA.join(",") !== keysB.join(",")) {
      return [
        `${p}: key mismatch (legacy=[${keysA.join(",")}] vs generated=[${keysB.join(",")}])`,
      ]
    }
    const result: string[] = []
    for (const k of keysA) {
      result.push(...deepDiff(ao[k], bo[k], `${p}.${k}`))
    }
    return result
  }
  return [`${p}: value mismatch (${JSON.stringify(a)} vs ${JSON.stringify(b)})`]
}

function byNumericId(a: unknown, b: unknown): number {
  const ai = (a as { id?: unknown })?.id
  const bi = (b as { id?: unknown })?.id
  if (typeof ai === "number" && typeof bi === "number") return ai - bi
  return String(ai).localeCompare(String(bi))
}

function itemKey(item: unknown): string {
  const id = (item as { id?: unknown })?.id
  return id === undefined ? "?" : String(id)
}

main().catch((err) => {
  console.error("[diff-halls] FAILED:")
  console.error(err)
  process.exit(1)
})
