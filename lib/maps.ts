// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - 検索クエリは原則「店舗名・ホール名のみ」（エリア名は付与しない）
// - 経路検索の起点はホール座標を優先（ホール名に地名が含まれると
//   飲食店側のテキスト解決にエリア名が付くことがあるため）
// - 経路検索の終点（飲食店）は名称のみ
// - 住所 (address) はマップ検索には使わない（UI 表示専用）
// - 明示的な map_query / google_maps_query があれば buildMapQuery で優先可能

export type MapLatLng = {
  lat: number
  lng: number
}

type MapEndpointOptions = {
  mapQuery?: string
  latLng?: MapLatLng
  /** true のとき座標をクエリに使う（名称はフォールバック用） */
  preferLatLng?: boolean
}

/** 名称を Google マップ検索クエリ用にエンコードする。mapQuery 指定時はそちらを優先 */
export const buildMapQuery = (name: string, mapQuery?: string): string => {
  const query = mapQuery?.trim() ? mapQuery : name
  return encodeURIComponent(query)
}

/** 名称または座標をマップ URL の地点クエリに変換する */
export const buildMapEndpoint = (
  name: string,
  options?: MapEndpointOptions,
): string => {
  if (options?.preferLatLng && options.latLng) {
    return encodeURIComponent(`${options.latLng.lat},${options.latLng.lng}`)
  }
  return buildMapQuery(name, options?.mapQuery)
}

type RouteMapOptions = {
  originMapQuery?: string
  originLatLng?: MapLatLng
  destinationMapQuery?: string
}

/**
 * Google マップ 単一地点埋め込み URL（名称で検索）
 * パチンコホールカード等で使用。
 */
export const generateMapEmbedUrl = (name: string, mapQuery?: string): string =>
  `https://maps.google.com/maps?q=${buildMapQuery(name, mapQuery)}&output=embed&z=17`

/**
 * Google マップ ルート埋め込み URL（origin → destination / 徒歩）
 * ホール詳細ページ内の飲食店カードで使用。
 * 起点は座標優先、終点は飲食店名称のみ。
 */
export const generateRouteEmbedUrl = (
  originName: string,
  destinationName: string,
  options?: RouteMapOptions,
): string => {
  const origin = buildMapEndpoint(originName, {
    mapQuery: options?.originMapQuery,
    latLng: options?.originLatLng,
    preferLatLng: Boolean(options?.originLatLng),
  })
  const destination = buildMapQuery(destinationName, options?.destinationMapQuery)
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ ルート案内（外部リンク）URL
 * 「道順を調べる」ボタン用。新規タブで Google マップ本体を開く。
 * 起点は座標優先、終点は飲食店名称のみ。
 */
export const getGoogleMapsDirectionUrl = (
  originName: string,
  destinationName: string,
  options?: RouteMapOptions,
): string => {
  const origin = buildMapEndpoint(originName, {
    mapQuery: options?.originMapQuery,
    latLng: options?.originLatLng,
    preferLatLng: Boolean(options?.originLatLng),
  })
  const destination = buildMapQuery(destinationName, options?.destinationMapQuery)
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
