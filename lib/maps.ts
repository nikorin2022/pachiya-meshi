// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - 経路検索の起点・終点は座標を優先（名称解決の誤吸着を避ける）
// - 座標がない場合は map_query → 名称+住所 → 名称 の順でフォールバック
// - 住所 (address) は UI 表示と名称フォールバック時の検索クエリに使用

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
  /** true のとき座標をクエリに使う（名称はフォールバック用） */
  preferLatLng?: boolean
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
export const isValidMapLatLng = (latLng?: MapLatLng): boolean => {
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

/** 名称・住所・座標をマップ URL の地点クエリに変換する */
export const buildMapEndpoint = (
  name: string,
  options?: MapEndpointOptions,
): string => {
  if (options?.preferLatLng && isValidMapLatLng(options.latLng)) {
    return encodeURIComponent(`${options.latLng!.lat},${options.latLng!.lng}`)
  }
  return buildMapQuery(name, {
    mapQuery: options?.mapQuery,
    address: options?.address,
  })
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
    address: options?.address,
    latLng: options?.latLng,
    preferLatLng: isValidMapLatLng(options?.latLng),
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
    address: options?.originAddress,
    latLng: options?.originLatLng,
    preferLatLng: isValidMapLatLng(options?.originLatLng),
  })
  const destination = buildMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    address: options?.destinationAddress,
    latLng: options?.destinationLatLng,
    preferLatLng: isValidMapLatLng(options?.destinationLatLng),
  })
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ 地点検索（外部リンク）URL
 * 「Google Mapsで開く」リンク用。座標優先、次に名称+住所。
 */
export const getGoogleMapsPlaceUrl = (
  name: string,
  options?: MapEmbedOptions,
): string => {
  const query = buildMapEndpoint(name, {
    mapQuery: options?.mapQuery,
    address: options?.address,
    latLng: options?.latLng,
    preferLatLng: isValidMapLatLng(options?.latLng),
  })
  return `https://www.google.com/maps/search/?api=1&query=${query}`
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
    address: options?.originAddress,
    latLng: options?.originLatLng,
    preferLatLng: isValidMapLatLng(options?.originLatLng),
  })
  const destination = buildMapEndpoint(destinationName, {
    mapQuery: options?.destinationMapQuery,
    address: options?.destinationAddress,
    latLng: options?.destinationLatLng,
    preferLatLng: isValidMapLatLng(options?.destinationLatLng),
  })
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
