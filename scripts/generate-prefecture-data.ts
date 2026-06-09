// CLI: 都道府県別ホールデータを data/ から lib/halls/_generated/ へ生成
//
// 使い方:
//   npm run generate:halls               全都道府県
//   npm run generate:halls -- tokyo      tokyo のみ
//   npm run generate:halls -- tokyo kanagawa
//
// 終了コード:
//   0  正常終了 (warnings は exit code に影響しない)
//   1  スキーマ違反 / マスタ参照失敗 / その他例外

import path from "node:path"
import { fileURLToPath } from "node:url"
import { FileDataSource } from "./sources/file-source"
import { generate } from "./lib/generator"

async function main() {
  const args = process.argv.slice(2)
  const targets = args.length > 0 ? args : undefined

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(scriptsDir, "..")
  const dataRoot = path.join(projectRoot, "data")
  const outputRoot = path.join(projectRoot, "lib", "halls", "_generated")

  console.log("[generate-prefecture-data] start")
  console.log(`  dataRoot:   ${dataRoot}`)
  console.log(`  outputRoot: ${outputRoot}`)
  console.log(`  targets:    ${targets ? targets.join(", ") : "(all)"}`)

  const source = new FileDataSource(dataRoot)
  const result = await generate({ source, outputRoot, prefectures: targets })

  console.log("")
  console.log("[generate-prefecture-data] done")
  console.log(`  prefectures: ${result.prefectures.length}`)
  for (const p of result.prefectures) {
    console.log(
      `    - ${p.prefecture}: halls=${p.hallCount}, restaurants=${p.restaurantCount}`,
    )
    console.log(`      -> ${path.relative(projectRoot, p.outputPath)}`)
  }
  console.log(`  total halls:       ${result.totalHalls}`)
  console.log(`  total restaurants: ${result.totalRestaurants}`)
  console.log(`  index: ${path.relative(projectRoot, result.indexPath)}`)

  if (result.warnings.length > 0) {
    console.warn("")
    console.warn("[warnings]")
    for (const w of result.warnings) console.warn(`  - ${w}`)
  }
}

main().catch((err) => {
  console.error("[generate-prefecture-data] FAILED:")
  console.error(err)
  process.exit(1)
})
