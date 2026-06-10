"use client"

import type { MouseEvent } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFavoriteHalls } from "@/components/FavoriteHallsProvider"

type Props = {
  hallId: string
  /** ホール詳細のモバイル用（アイコンのみ・小サイズ） */
  iconOnly?: boolean
  /** ホール詳細のデスクトップ用（「お気に入り」ラベル付き） */
  showLabel?: boolean
  /** 一覧カード用のシンプルなアイコンボタン */
  variant?: "card" | "detail"
  className?: string
}

/**
 * お気に入り登録・解除ボタン。
 * localStorage と同期し、同一 hall_id なら全画面で状態が揃う。
 */
export function FavoriteHallButton({
  hallId,
  iconOnly = false,
  showLabel = false,
  variant = "detail",
  className = "",
}: Props) {
  const { loaded, isFavorite, toggleFavorite } = useFavoriteHalls()
  const favorited = loaded && isFavorite(hallId)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    toggleFavorite(hallId)
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={favorited ? "お気に入りから削除" : "お気に入りに追加"}
        aria-pressed={favorited}
        className={`p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ${className}`}
      >
        <Heart
          className={`w-4 h-4 sm:w-5 sm:h-5 ${favorited ? "fill-red-500 text-red-500" : ""}`}
        />
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant={favorited ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      aria-label={favorited ? "お気に入りから削除" : "お気に入りに追加"}
      aria-pressed={favorited}
      className={`shrink-0 gap-1 ${
        iconOnly ? "h-7 px-2 text-xs" : ""
      } ${
        favorited
          ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
          : "text-red-500 border-red-500 hover:bg-red-50"
      } ${className}`}
    >
      <Heart
        className={`${iconOnly ? "w-3 h-3" : "w-4 h-4"} ${favorited ? "fill-current" : ""}`}
      />
      {showLabel && !iconOnly ? "お気に入り" : null}
    </Button>
  )
}
