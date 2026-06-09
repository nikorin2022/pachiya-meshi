// FileDataSource: data/ 配下の JSON を読み込む PrefectureDataSource 実装
//
// 設計方針:
//   - マスタ (areas/chains) は必須: 不在ならエラー
//   - 都道府県別 (halls/restaurants) も必須: ディレクトリが存在する前提で必須
//   - overrides は任意: ファイル不在なら空配列で扱う
//   - JSON パース失敗・スキーマ違反は早期に例外で落とす (build を中断させる)

import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import {
  AreaSchema,
  ChainSchema,
  HallSchema,
  RestaurantSchema,
  WalkMinutesOverrideSchema,
  AiSummaryOverrideSchema,
  ExclusionOverrideSchema,
} from "../lib/schema"
import type { PrefectureDataSource } from "./types"

export class FileDataSource implements PrefectureDataSource {
  constructor(private readonly dataRoot: string) {}

  async loadAreas() {
    return this.loadRequired("areas.json", AreaSchema)
  }

  async loadChains() {
    return this.loadRequired("chains.json", ChainSchema)
  }

  async listPrefectures(): Promise<string[]> {
    const dir = path.join(this.dataRoot, "prefectures")
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
      throw err
    }
  }

  async loadHalls(prefecture: string) {
    return this.loadRequired(
      `prefectures/${prefecture}/halls.json`,
      HallSchema,
    )
  }

  async loadRestaurants(prefecture: string) {
    return this.loadRequired(
      `prefectures/${prefecture}/restaurants.json`,
      RestaurantSchema,
    )
  }

  async loadWalkMinutesOverrides() {
    return this.loadOptional(
      "overrides/walk-minutes.json",
      WalkMinutesOverrideSchema,
    )
  }

  async loadAiSummaryOverrides() {
    return this.loadOptional(
      "overrides/ai-summary.json",
      AiSummaryOverrideSchema,
    )
  }

  async loadExclusions() {
    return this.loadOptional(
      "overrides/exclusions.json",
      ExclusionOverrideSchema,
    )
  }

  /** ファイル必須。不在ならエラー。 */
  private async loadRequired<T>(
    relPath: string,
    itemSchema: z.ZodType<T>,
  ): Promise<T[]> {
    const abs = path.join(this.dataRoot, relPath)
    const raw = await fs.readFile(abs, "utf8")
    const parsed = JSON.parse(raw)
    return this.parseArray(parsed, itemSchema, relPath)
  }

  /** ファイル任意。不在なら空配列で扱う。 */
  private async loadOptional<T>(
    relPath: string,
    itemSchema: z.ZodType<T>,
  ): Promise<T[]> {
    const abs = path.join(this.dataRoot, relPath)
    let raw: string
    try {
      raw = await fs.readFile(abs, "utf8")
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
      throw err
    }
    const parsed = JSON.parse(raw)
    return this.parseArray(parsed, itemSchema, relPath)
  }

  private parseArray<T>(
    value: unknown,
    itemSchema: z.ZodType<T>,
    relPath: string,
  ): T[] {
    const result = z.array(itemSchema).safeParse(value)
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")
      throw new Error(`[${relPath}] スキーマ違反:\n${issues}`)
    }
    return result.data
  }
}
