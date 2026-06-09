// TS ソース整形 + ファイル出力
//
// 出力先:
//   lib/halls/_generated/<prefecture>.ts  : 都道府県別ホール配列
//   lib/halls/_generated/index.ts         : 全都道府県を集約した getAllHalls 等
//
// Phase C の方針:
//   - 既存 lib/halls/types.ts の PachinkoHall 型をそのまま import して使う
//   - 既存サイトはこの _generated を一切 import しない (確認用ファイル)
//   - データは JSON.stringify で生成。TS リテラルとしてもそのまま valid。

import fs from "node:fs/promises"
import path from "node:path"
import type { LegacyHall } from "./hall-builder"

const GENERATED_HEADER = `// ================================================================
// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Source: data/prefectures/<pref>/*.json + data/{areas,chains}.json
// Run \`npm run generate:halls\` to regenerate.
// ================================================================
`

export class TsEmitter {
  constructor(private readonly outputRoot: string) {}

  /** 1 都道府県分のホール配列を <prefecture>.ts として書き出す */
  async emitPrefecture(
    prefecture: string,
    halls: LegacyHall[],
  ): Promise<string> {
    const identifier = toJsIdentifier(prefecture)
    const literal = JSON.stringify(halls, null, 2)

    const body = `${GENERATED_HEADER}
import type { PachinkoHall } from "../types"

export const ${identifier}Halls: readonly PachinkoHall[] = ${literal} as const
`

    const outPath = path.join(this.outputRoot, `${prefecture}.ts`)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, body, "utf8")
    return outPath
  }

  /** 都道府県別ファイルを集約する _generated/index.ts を書き出す */
  async emitIndex(prefectures: string[]): Promise<string> {
    const sorted = [...prefectures].sort()

    const imports = sorted
      .map(
        (p) =>
          `import { ${toJsIdentifier(p)}Halls } from "./${p}"`,
      )
      .join("\n")

    const concatItems =
      sorted.length === 0
        ? "  // (まだホールデータが投入されていません)"
        : sorted
            .map((p) => `  ...${toJsIdentifier(p)}Halls,`)
            .join("\n")

    const body = `${GENERATED_HEADER}
import type { PachinkoHall } from "../types"
${imports ? imports + "\n" : ""}
const halls: readonly PachinkoHall[] = [
${concatItems}
] as const

export const getAllHalls = (): readonly PachinkoHall[] => halls
export const getHallById = (id: string): PachinkoHall | undefined =>
  halls.find((h) => h.id === id)
export const getAllHallIds = (): string[] => halls.map((h) => h.id)
`

    const outPath = path.join(this.outputRoot, "index.ts")
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, body, "utf8")
    return outPath
  }
}

/** "tokyo-23ku" → "tokyo_23ku" のように JS 識別子へ変換 */
function toJsIdentifier(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "_")
}
