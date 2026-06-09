// マスタ参照解決
//
// 役割:
//   - area_id / chain_id を高速に lookup できるよう Map 化する
//   - ID 重複・参照不整合を build 時に検出
//   - hall や restaurant 側からは display name を解決して取り出す

import type { Area, Chain } from "./schema"

export class MasterResolver {
  private readonly areaMap: Map<string, Area>
  private readonly chainMap: Map<string, Chain>

  private constructor(areaMap: Map<string, Area>, chainMap: Map<string, Chain>) {
    this.areaMap = areaMap
    this.chainMap = chainMap
  }

  /** マスタ整合性 (ID重複等) を検証しつつインスタンスを生成 */
  static fromMasters(areas: Area[], chains: Chain[]): MasterResolver {
    const areaMap = new Map<string, Area>()
    for (const a of areas) {
      if (areaMap.has(a.id)) {
        throw new Error(`areas.json: 重複 id "${a.id}"`)
      }
      areaMap.set(a.id, a)
    }

    const chainMap = new Map<string, Chain>()
    for (const c of chains) {
      if (chainMap.has(c.id)) {
        throw new Error(`chains.json: 重複 id "${c.id}"`)
      }
      chainMap.set(c.id, c)
    }

    return new MasterResolver(areaMap, chainMap)
  }

  /** 必須参照。未定義の area_id を渡すとエラー。 */
  getArea(areaId: string): Area {
    const area = this.areaMap.get(areaId)
    if (!area) {
      throw new Error(`unknown area_id: "${areaId}" (areas.json に未登録)`)
    }
    return area
  }

  /** 任意参照。未定義 id や undefined は null を返す。 */
  getAreaOrNull(areaId: string | undefined): Area | null {
    if (!areaId) return null
    return this.areaMap.get(areaId) ?? null
  }

  /** 必須参照。 */
  getChain(chainId: string): Chain {
    const chain = this.chainMap.get(chainId)
    if (!chain) {
      throw new Error(`unknown chain_id: "${chainId}" (chains.json に未登録)`)
    }
    return chain
  }

  /** 任意参照。 */
  getChainOrNull(chainId: string | undefined): Chain | null {
    if (!chainId) return null
    return this.chainMap.get(chainId) ?? null
  }
}
