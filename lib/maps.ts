// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - Place表示・経路検索とも name + address を第一候補（Google の店舗 POI 解決を優先）
// - 座標はフォールバック（住所欠損時や名称解決の補助）
// - 住所 (address) は UI 表示とマップ検索クエリの両方に使用

export type MapLatLng = {
  lat: number
  lng: number
}

type MapQueryOptions = {
  mapQuery?: string
  address?: string
}

type MapEndpointOptions = MapQueryOptions & {
  latLng?: MapLatLng
}

type MapEmbedOptions = MapQueryOptions & {
  latLng?: MapLatLng
}

type RouteMapOptions = {
  originMapQuery?: string
  originAddress?: string
  originLatLng?: MapLatLng
  destinationMapQuery?: string
  destinationAddress?: string
  destinationLatLng?: MapLatLng
}

/** 日本国内として妥当な座標か（マップ URL 生成用） */
export const isValidMapLatLng = (latLng?: MapLatLng): latLng is MapLatLng => {
  if (!latLng) return false
  const { lat, lng } = latLng
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 24 &&
    lat <= 46 &&
    lng >= 122 &&
    lng <= 154
  )
}

/**
 * 名称・住所・map_query を Google マップ検索クエリ用にエンコードする。
 * 優先順: map_query → name + address → name
 */
export const buildMapQuery = (
  name: string,
  options?: MapQueryOptions,
): string => {
  const custom = options?.mapQuery?.trim()
  if (custom) return encodeURIComponent(custom)

  const address = options?.address?.trim()
  if (address) return encodeURIComponent(`${name} ${address}`)

  return encodeURIComponent(name)
}

/**
 * Place表示用の地点クエリ。
 * 優先順: map_query → name + address → lat,lng → name
 */
export const buildPlaceMapEndpoint = (
  name: string,
  options?: MapEndpointOptions,
): string => {
  const custom = options?.mapQuery?.trim()
  if (custom) return encodeURIComponent(custom)

  const address = options?.address?.trim()
  if (address) return encodeURIComponent(`${name} ${address}`)

  const latLng = options?.latLng
  if (isValidMapLatLng(latLng)) {
    return encodeURIComponent(`${latLng.lat},${latLng.lng}`)
  }

  return encodeURIComponent(name)
}

/** 経路表示用の地点クエリ（Place表示と同じ優先順位） */
export const buildRouteMapEndpoint = buildPlaceMapEndpoint

/** @deprecated buildPlaceMapEndpoint を使用 */
export const buildMapEndpoint = buildPlaceMapEndpoint

/**
 * Google マップ 単一地点埋め込み URL
 * パチンコホールカード等で使用。name + address を優先。
 */
export const generateMapEmbedUrl = (
  name: string,
  mapQuery?: string,
  options?: MapEmbedOptions,
): string => {
  const q = buildPlaceMapEndpoint(name, {
    mapQuery: mapQuery ?? options?.mapQuery,
    address: options?.address,
    latLng: options?.latLng,
  })
  return `https://maps.google.com/maps?q=${q}&output=embed&z=17`
}

/**
 * Google マップ ルート埋め込み URL（origin → destination / 徒歩）
 * ホール詳細ページ内の飲食店カードで使用。
 * 起点・終点とも name + address を優先。
 */
export const generateRouteEmbedUrl = (
  originName: string,
  destinationName: string,
  options?: RouteMapOptions,
): string => {
  const origin = buildRouteMapEndpoint(originName, {
    mapQuery: options?.originMapQuery,
    address: options?.originAddress,
    latLng: options?.originLatLng,
  })
  const destination = buildRouteMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    address: options?.destinationAddress,
    latLng: options?.destinationLatLng,
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ 地点検索（外部リンク）URL
 * 「Google Mapsで開く」リンク用。name + address を優先。
 */
export const getGoogleMapsPlaceUrl = (
  name: string,
  options?: MapEmbedOptions,
): string => {
  const query = buildPlaceMapEndpoint(name, {
    mapQuery: options?.mapQuery,
    address: options?.address,
    latLng: options?.latLng,
  })
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

/**
 * Google マップ ルート案内（外部リンク）URL
 * 「道順を調べる」ボタン用。起点・終点とも name + address を優先。
 */
export const getGoogleMapsDirectionUrl = (
  originName: string,
  destinationName: string,
  options?: RouteMapOptions,
): string => {
  const origin = buildRouteMapEndpoint(originName, {
    mapQuery: options?.originMapQuery,
    address: options?.originAddress,
    latLng: options?.originLatLng,
  })
  const destination = buildRouteMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    address: options?.destinationAddress,
    latLng: options?.destinationLatLng,
  })
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
