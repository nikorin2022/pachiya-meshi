"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = {
  /** URL の q パラメータなど初期表示用 */
  defaultQuery?: string
  placeholder?: string
  /** 外側 form の class（モバイル用 mt-2 等） */
  className?: string
  inputClassName?: string
  buttonClassName?: string
}

/**
 * ホール検索フォーム。送信時に /search?q=... へ遷移する。
 * 空入力・空白のみの場合は送信しない（ボタンも disabled）。
 */
export function HallSearchForm({
  defaultQuery = "",
  placeholder = "ホール名・エリア名・駅名で検索（例：秋葉原、梅田、マルハン）",
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultQuery)
  const canSearch = query.trim().length > 0

  const submitSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submitSearch()
  }

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <label htmlFor="hall-search-input" className="sr-only">
        ホールを検索
      </label>
      <div className="flex">
        <Input
          id="hall-search-input"
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-label="ホールを検索"
          className={`rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${inputClassName}`}
        />
        <Button
          type="submit"
          disabled={!canSearch}
          aria-disabled={!canSearch}
          className={`rounded-l-none bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
        >
          検索
        </Button>
      </div>
    </form>
  )
}
