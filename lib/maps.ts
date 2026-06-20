// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - 経路検索の起点・終点は座標を優先（名称解決の誤吸着を避ける）
// - 座標がない場合のみ店舗名・ホール名、または map_query にフォールバック
// - 住所 (address) はマップ検索には使わない（UI 表示専用）

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

type MapEmbedOptions = {
  mapQuery?: string
  latLng?: MapLatLng
}

type RouteMapOptions = {
  originMapQuery?: string
  originLatLng?: MapLatLng
  destinationMapQuery?: string
  destinationLatLng?: MapLatLng
}

/**
 * Google マップ 単一地点埋め込み URL
 * パチンコホールカード等で使用。座標があれば座標優先。
 */
export const generateMapEmbedUrl = (
  name: string,
  mapQuery?: string,
  options?: MapEmbedOptions,
): string => {
  const q = buildMapEndpoint(name, {
    mapQuery: mapQuery ?? options?.mapQuery,
    latLng: options?.latLng,
    preferLatLng: Boolean(options?.latLng),
  })
  return `https://maps.google.com/maps?q=${q}&output=embed&z=17`
}

/**
 * Google マップ ルート埋め込み URL（origin → destination / 徒歩）
 * ホール詳細ページ内の飲食店カードで使用。
 * 起点・終点とも座標優先。
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
  const destination = buildMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    latLng: options?.destinationLatLng,
    preferLatLng: Boolean(options?.destinationLatLng),
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ ルート案内（外部リンク）URL
 * 「道順を調べる」ボタン用。新規タブで Google マップ本体を開く。
 * 起点・終点とも座標優先。
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
  const destination = buildMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    latLng: options?.destinationLatLng,
    preferLatLng: Boolean(options?.destinationLatLng),
  })
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
