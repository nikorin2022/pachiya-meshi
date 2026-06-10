export const FAVORITE_HALL_IDS_KEY = "pachiyaMeshi.favoriteHallIds"

export const FAVORITES_CHANGED_EVENT = "pachiyaMeshi:favorites-changed"

/** ブラウザで localStorage が利用可能か判定する */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const probe = "__pachiyaMeshi_storage_probe__"
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function parseFavoriteIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch {
    return []
  }
}

/** localStorage からお気に入り hall_id 一覧を読み込む（クライアント専用） */
export function readFavoriteHallIds(): string[] {
  if (!isLocalStorageAvailable()) return []
  try {
    return parseFavoriteIds(window.localStorage.getItem(FAVORITE_HALL_IDS_KEY))
  } catch {
    return []
  }
}

/** localStorage にお気に入り hall_id 一覧を保存する（クライアント専用） */
export function writeFavoriteHallIds(ids: readonly string[]): void {
  if (!isLocalStorageAvailable()) return
  try {
    window.localStorage.setItem(FAVORITE_HALL_IDS_KEY, JSON.stringify([...ids]))
  } catch {
    // 保存失敗時もページ動作は継続する
  }
}

/** お気に入りの登録・解除を切り替え、更新後の一覧を返す */
export function toggleFavoriteHallId(hallId: string): string[] {
  const current = readFavoriteHallIds()
  const next = current.includes(hallId)
    ? current.filter((id) => id !== hallId)
    : [...current, hallId]
  writeFavoriteHallIds(next)
  return next
}
