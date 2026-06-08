// Google マップ URL 生成ヘルパ
//
// 設計方針:
// - 住所 (address) は使わず、「店舗名 + エリア名」で検索クエリを組み立てる
// - エリア名はホールが保持し（PachinkoHall.area）、ホール周辺の飲食店も同じエリア名を共有する
// - これにより、秋葉原以外のエリアでも同じロジックで動作する（全国展開対応）

/** 「店舗名 + エリア名」を Google マップ検索クエリ用に組み立てる共通ヘルパ */
export const buildMapQuery = (name: string, area: string): string =>
  encodeURIComponent(`${name} ${area}`)

/**
 * Google マップ 単一地点埋め込み URL（"店舗名 + エリア名" で検索）
 * パチンコホールカード等で使用。
 */
export const generateMapEmbedUrl = (name: string, area: string): string =>
  `https://maps.google.com/maps?q=${buildMapQuery(name, area)}&output=embed&z=17`

/**
 * Google マップ ルート埋め込み URL（origin → destination / 徒歩）
 * ホール詳細ページ内の飲食店カードで使用。
 */
export const generateRouteEmbedUrl = (
  originName: string,
  destinationName: string,
  area: string,
): string => {
  const origin = buildMapQuery(originName, area)
  const destination = buildMapQuery(destinationName, area)
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

/**
 * Google マップ ルート案内（外部リンク）URL
 * 「道順を調べる」ボタン用。新規タブで Google マップ本体を開く。
 */
export const getGoogleMapsDirectionUrl = (
  originName: string,
  destinationName: string,
  area: string,
): string => {
  const origin = buildMapQuery(originName, area)
  const destination = buildMapQuery(destinationName, area)
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}
