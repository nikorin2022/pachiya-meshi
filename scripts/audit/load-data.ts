import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AUDIT_CONFIG_VERSION, AUDIT_RULE_VERSION, AUDIT_SCHEMA_VERSION } from "./config"
import { FileDataSource } from "../sources/file-source"
import type {
  AiSummaryOverride,
  Area,
  Chain,
  ExclusionOverride,
  HallInput,
  RestaurantInput,
  WalkMinutesOverride,
} from "../lib/schema"
import {
  AuditLoadError,
  type AuditData,
  type AuditIndexes,
  type CheckedFile,
} from "./types"

export type LoadAuditDataOptions = {
  repositoryRoot?: string
}

type PrefectureRecords = {
  prefecture: string
  halls: readonly HallInput[]
  restaurants: readonly RestaurantInput[]
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultRepositoryRoot = path.resolve(moduleDirectory, "..", "..")

/**
 * 既存FileDataSourceを1回ずつ呼び出して正本データを読み込む。
 * 元配列を保持したまま、後続監査向けの索引と入力ハッシュを組み立てる。
 */
export async function loadAuditData(
  options: LoadAuditDataOptions = {},
): Promise<AuditData> {
  const repositoryRoot = await resolveRepositoryRoot(options.repositoryRoot)
  const dataRoot = path.join(repositoryRoot, "data")
  const source = new FileDataSource(dataRoot)

  const [areas, chains, walkMinutesOverrides, aiSummaryOverrides, exclusions, prefectures] =
    await Promise.all([
      loadSourceValue("data/areas.json", () => source.loadAreas()),
      loadSourceValue("data/chains.json", () => source.loadChains()),
      loadSourceValue("data/overrides/walk-minutes.json", () =>
        source.loadWalkMinutesOverrides(),
      ),
      loadSourceValue("data/overrides/ai-summary.json", () => source.loadAiSummaryOverrides()),
      loadSourceValue("data/overrides/exclusions.json", () => source.loadExclusions()),
      loadSourceValue("data/prefectures", () => source.listPrefectures()),
    ])

  if (prefectures.length === 0) {
    throw new AuditLoadError(
      "prefecture_data_missing",
      "監査対象の都道府県データがありません",
      { file: "data/prefectures" },
    )
  }

  const prefectureRecords = await Promise.all(
    prefectures.map(async (prefecture): Promise<PrefectureRecords> => {
      const [halls, restaurants] = await Promise.all([
        loadSourceValue(`data/prefectures/${prefecture}/halls.json`, () =>
          source.loadHalls(prefecture),
        ),
        loadSourceValue(`data/prefectures/${prefecture}/restaurants.json`, () =>
          source.loadRestaurants(prefecture),
        ),
      ])
      return { prefecture, halls, restaurants }
    }),
  )

  const frozenAreas = freezeReadonly(areas)
  const frozenChains = freezeReadonly(chains)
  const frozenWalkMinutesOverrides = freezeReadonly(walkMinutesOverrides)
  const frozenAiSummaryOverrides = freezeReadonly(aiSummaryOverrides)
  const frozenExclusions = freezeReadonly(exclusions)
  const frozenPrefectureRecords = freezeReadonly(prefectureRecords)

  const hallsByPrefecture = new Map<string, readonly HallInput[]>()
  const restaurantsByPrefecture = new Map<string, readonly RestaurantInput[]>()
  for (const record of frozenPrefectureRecords) {
    hallsByPrefecture.set(record.prefecture, record.halls)
    restaurantsByPrefecture.set(record.prefecture, record.restaurants)
  }

  const halls = freezeReadonly(frozenPrefectureRecords.flatMap((record) => record.halls))
  const restaurants = freezeReadonly(
    frozenPrefectureRecords.flatMap((record) => record.restaurants),
  )
  const sortedPrefectures = freezeReadonly([...prefectures].sort())
  const frozenHallsByPrefecture = readonlyMap(hallsByPrefecture)
  const frozenRestaurantsByPrefecture = readonlyMap(restaurantsByPrefecture)

  const checkedFiles = await collectCheckedFiles(repositoryRoot, {
    areas: frozenAreas,
    chains: frozenChains,
    prefectureRecords: frozenPrefectureRecords,
    walkMinutesOverrides: frozenWalkMinutesOverrides,
    aiSummaryOverrides: frozenAiSummaryOverrides,
    exclusions: frozenExclusions,
  })

  const indexes: AuditIndexes = Object.freeze({
    areaById: firstById(frozenAreas),
    chainById: firstById(frozenChains),
    hallById: firstById(halls),
    restaurantById: firstById(restaurants),
    hallsByPrefecture: frozenHallsByPrefecture,
    restaurantsByPrefecture: frozenRestaurantsByPrefecture,
  })

  return Object.freeze({
    repositoryRoot,
    prefectures: sortedPrefectures,
    areas: frozenAreas,
    chains: frozenChains,
    halls,
    restaurants,
    hallsByPrefecture: frozenHallsByPrefecture,
    restaurantsByPrefecture: frozenRestaurantsByPrefecture,
    walkMinutesOverrides: frozenWalkMinutesOverrides,
    aiSummaryOverrides: frozenAiSummaryOverrides,
    exclusions: frozenExclusions,
    indexes,
    checkedFiles,
    inputHash: createInputHash(checkedFiles),
    checkedEntities:
      frozenAreas.length +
      frozenChains.length +
      halls.length +
      restaurants.length +
      frozenWalkMinutesOverrides.length +
      frozenAiSummaryOverrides.length +
      frozenExclusions.length,
  })
}

async function resolveRepositoryRoot(candidate?: string): Promise<string> {
  const repositoryRoot = path.resolve(candidate ?? defaultRepositoryRoot)
  try {
    const data = await fs.stat(path.join(repositoryRoot, "data"))
    if (!data.isDirectory()) {
      throw new Error("data is not a directory")
    }
    return repositoryRoot
  } catch (error) {
    throw new AuditLoadError(
      "repository_root",
      "監査対象リポジトリを解決できませんでした",
      { cause: error },
    )
  }
}

async function loadSourceValue<T>(
  relativeFile: string,
  load: () => Promise<T>,
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    throw toAuditLoadError(error, relativeFile)
  }
}

function toAuditLoadError(error: unknown, relativeFile: string): AuditLoadError {
  if (error instanceof AuditLoadError) return error

  if (error instanceof SyntaxError) {
    return new AuditLoadError("json_parse", "監査入力JSONを解析できませんでした", {
      file: relativeFile,
      cause: error,
    })
  }

  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === "ENOENT") {
    return new AuditLoadError("file_missing", "監査入力ファイルが見つかりません", {
      file: relativeFile,
      cause: error,
    })
  }

  const message = error instanceof Error ? error.message : ""
  if (message.includes("スキーマ違反")) {
    return new AuditLoadError("schema_validation", "監査入力がスキーマに適合しません", {
      file: relativeFile,
      cause: error,
    })
  }

  return new AuditLoadError("file_read", "監査入力の読み込みに失敗しました", {
    file: relativeFile,
    cause: error,
  })
}

async function collectCheckedFiles(
  repositoryRoot: string,
  input: {
    areas: readonly Area[]
    chains: readonly Chain[]
    prefectureRecords: readonly PrefectureRecords[]
    walkMinutesOverrides: readonly WalkMinutesOverride[]
    aiSummaryOverrides: readonly AiSummaryOverride[]
    exclusions: readonly ExclusionOverride[]
  },
): Promise<readonly CheckedFile[]> {
  const entries: Array<{ file: string; entities: number; optional?: boolean }> = [
    { file: "data/areas.json", entities: input.areas.length },
    { file: "data/chains.json", entities: input.chains.length },
    {
      file: "data/overrides/walk-minutes.json",
      entities: input.walkMinutesOverrides.length,
      optional: true,
    },
    {
      file: "data/overrides/ai-summary.json",
      entities: input.aiSummaryOverrides.length,
      optional: true,
    },
    {
      file: "data/overrides/exclusions.json",
      entities: input.exclusions.length,
      optional: true,
    },
    ...input.prefectureRecords.flatMap((record) => [
      {
        file: `data/prefectures/${record.prefecture}/halls.json`,
        entities: record.halls.length,
      },
      {
        file: `data/prefectures/${record.prefecture}/restaurants.json`,
        entities: record.restaurants.length,
      },
    ]),
  ]

  const checked = await Promise.all(
    entries.map(async (entry) => {
      const content = await readInputFile(repositoryRoot, entry.file, entry.optional)
      if (content === null) return null
      return {
        file: entry.file,
        sha256: sha256(content),
        entities: entry.entities,
      }
    }),
  )

  return freezeReadonly(
    checked
      .filter((entry): entry is CheckedFile => entry !== null)
      .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)),
  )
}

async function readInputFile(
  repositoryRoot: string,
  relativeFile: string,
  optional = false,
): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(repositoryRoot, ...relativeFile.split("/")))
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw toAuditLoadError(error, relativeFile)
  }
}

function createInputHash(checkedFiles: readonly CheckedFile[]): string {
  const hashInput = JSON.stringify({
    checkedFiles: checkedFiles.map(({ file, sha256 }) => ({ file, sha256 })),
    auditSchemaVersion: AUDIT_SCHEMA_VERSION,
    auditRuleVersion: AUDIT_RULE_VERSION,
    auditConfigVersion: AUDIT_CONFIG_VERSION,
  })
  return sha256(hashInput)
}

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex")
}

function firstById<T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  const index = new Map<string, T>()
  for (const item of items) {
    if (!index.has(item.id)) index.set(item.id, item)
  }
  return readonlyMap(index)
}

function readonlyMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  /**
   * ReadonlyMap はTypeScript上の読み取り専用契約であり、Mapの実行時完全不変化は目的としない。
   * 監査処理からは set / delete / clear を呼ばない。
   */
  return map
}

function freezeReadonly<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeReadonly(child)
    Object.freeze(value)
  }
  return value
}
