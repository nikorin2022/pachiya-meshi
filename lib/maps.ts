// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - 検索クエリは原則「店舗名・ホール名のみ」（エリア名は付与しない）
// - 密集地では「名称 + エリア名」だと別施設がヒットしやすいため
// - 住所 (address) はマップ検索には使わない（UI 表示専用）
// - 明示的な map_query / google_maps_query があれば buildMapQuery で優先可能

/** 名称を Google マップ検索クエリ用にエンコードする。mapQuery 指定時はそちらを優先 */
export const buildMapQuery = (name: string, mapQuery?: string): string => {
  const query = mapQuery?.trim() ? mapQuery : name
  return encodeURIComponent(query)
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
 */
export const generateRouteEmbedUrl = (
  originName: string,
  destinationName: string,
  originMapQuery?: string,
  destinationMapQuery?: string,
): string => {
  const origin = buildMapQuery(originName, originMapQuery)
  const destination = buildMapQuery(destinationName, destinationMapQuery)
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ ルート案内（外部リンク）URL
 * 「道順を調べる」ボタン用。新規タブで Google マップ本体を開く。
 */
export const getGoogleMapsDirectionUrl = (
  originName: string,
  destinationName: string,
  originMapQuery?: string,
  destinationMapQuery?: string,
): string => {
  const origin = buildMapQuery(originName, originMapQuery)
  const destination = buildMapQuery(destinationName, destinationMapQuery)
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
