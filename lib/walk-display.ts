/** Haversine 推定の徒歩分数表示（Google Maps 実測ではない） */
export function formatWalkEstimateLabel(minutes: number): string {
  return `徒歩目安${minutes}分`
}
