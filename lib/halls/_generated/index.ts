// ================================================================
// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Source: data/prefectures/<pref>/*.json + data/{areas,chains}.json
// Run `npm run generate:halls` to regenerate.
// ================================================================

import type { PachinkoHall } from "../types"
import { aichiHalls } from "./aichi"
import { fukuokaHalls } from "./fukuoka"
import { hokkaidoHalls } from "./hokkaido"
import { miyagiHalls } from "./miyagi"
import { osakaHalls } from "./osaka"
import { tokyoHalls } from "./tokyo"

const halls: readonly PachinkoHall[] = [
  ...aichiHalls,
  ...fukuokaHalls,
  ...hokkaidoHalls,
  ...miyagiHalls,
  ...osakaHalls,
  ...tokyoHalls,
] as const

export const getAllHalls = (): readonly PachinkoHall[] => halls
export const getHallById = (id: string): PachinkoHall | undefined =>
  halls.find((h) => h.id === id)
export const getAllHallIds = (): string[] => halls.map((h) => h.id)
