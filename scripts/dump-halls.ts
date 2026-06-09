// dump-halls: 既存 lib/halls/index.ts (= 手書きの TS データ) を JSON で書き出す
//
// 用途:
//   Phase C 検証時、生成パイプラインの出力と既存データを diff するための
//   スナップショットを作る。
//
// 使い方:
//   npm run dump:halls
//   npm run dump:halls -- halls-legacy.json
//
// 出力先 (デフォルト): プロジェクトルート/halls-legacy.json

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

async function main() {
  const args = process.argv.slice(2)
  const output = args[0] ?? "halls-legacy.json"

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(scriptsDir, "..")
  const indexTsPath = path.join(projectRoot, "lib", "halls", "index.ts")

  // tsx ランタイムなら .ts ファイルを直接 import 可能。
  // Windows では絶対パスを file:// URL に変換する必要がある (Node ESM 仕様)。
  const indexModule: { getAllHalls: () => unknown[] } = await import(
    pathToFileURL(indexTsPath).href
  )
  const halls = indexModule.getAllHalls()

  const outPath = path.isAbsolute(output)
    ? output
    : path.join(projectRoot, output)
  await fs.writeFile(outPath, JSON.stringify(halls, null, 2), "utf8")

  console.log(`[dump-halls] wrote ${halls.length} halls`)
  console.log(`  -> ${path.relative(projectRoot, outPath)}`)
}

main().catch((err) => {
  console.error("[dump-halls] FAILED:")
  console.error(err)
  process.exit(1)
})
