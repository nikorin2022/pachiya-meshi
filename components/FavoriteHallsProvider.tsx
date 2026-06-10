"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  FAVORITE_HALL_IDS_KEY,
  FAVORITES_CHANGED_EVENT,
  readFavoriteHallIds,
  toggleFavoriteHallId,
} from "@/lib/favorite-halls"

type FavoriteHallsContextValue = {
  /** useEffect 後に true。hydration mismatch 回避用 */
  loaded: boolean
  favoriteIds: readonly string[]
  isFavorite: (hallId: string) => boolean
  toggleFavorite: (hallId: string) => void
}

const FavoriteHallsContext = createContext<FavoriteHallsContextValue | null>(null)

export function FavoriteHallsProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<readonly string[]>([])
  const [loaded, setLoaded] = useState(false)

  const syncFromStorage = useCallback(() => {
    setFavoriteIds(readFavoriteHallIds())
  }, [])

  useEffect(() => {
    syncFromStorage()
    setLoaded(true)

    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_HALL_IDS_KEY || event.key === null) {
        syncFromStorage()
      }
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFromStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFromStorage)
    }
  }, [syncFromStorage])

  const toggleFavorite = useCallback((hallId: string) => {
    const next = toggleFavoriteHallId(hallId)
    setFavoriteIds(next)
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
  }, [])

  const isFavorite = useCallback(
    (hallId: string) => favoriteIds.includes(hallId),
    [favoriteIds],
  )

  const value = useMemo(
    () => ({ loaded, favoriteIds, isFavorite, toggleFavorite }),
    [loaded, favoriteIds, isFavorite, toggleFavorite],
  )

  return (
    <FavoriteHallsContext.Provider value={value}>
      {children}
    </FavoriteHallsContext.Provider>
  )
}

export function useFavoriteHalls(): FavoriteHallsContextValue {
  const context = useContext(FavoriteHallsContext)
  if (!context) {
    throw new Error("useFavoriteHalls must be used within FavoriteHallsProvider")
  }
  return context
}
