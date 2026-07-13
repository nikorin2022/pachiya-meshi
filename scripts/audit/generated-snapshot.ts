import { getAllHalls } from "../../lib/halls/_generated"
import type { PachinkoHall } from "../../lib/halls/types"

/** 生成物は読み取り専用で参照し、監査から書き換えない。 */
export function getGeneratedHallsSnapshot(): readonly PachinkoHall[] {
  return getAllHalls()
}
