"use client"

import { useState, useMemo, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Search,
  MapPin,
  Heart,
  Clock,
  ChevronRight,
  Sun,
  Utensils,
  Moon,
  Navigation,
  ExternalLink,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FavoriteHallButton } from "@/components/FavoriteHallButton"
import { useFavoriteHalls } from "@/components/FavoriteHallsProvider"
import { HallSearchForm } from "@/components/HallSearchForm"
import { Badge } from "@/components/ui/badge"
import type { PachinkoHall } from "@/lib/halls/types"
import {
  timeFilters,
  walkFilters,
  genreFilters,
  genreFallbackStyles,
} from "@/lib/ui-constants"
import {
  generateMapEmbedUrl,
  generateRouteEmbedUrl,
  getGoogleMapsDirectionUrl,
} from "@/lib/maps"
import { selectRecommendedRestaurantsTop3 } from "@/lib/restaurant-recommendations"
import { getChainForHall, getChainPagePath } from "@/lib/chains"

// ============================================================
// 子コンポーネント（このページ専用）
// ============================================================

/**
 * 飲食店カード用の地図埋め込み。
 * ホールから飲食店への徒歩ルートを表示する。iframe 読み込み失敗時は
 * ジャンル別のグラデーション + 絵文字のフォールバックを表示する。
 */
function StoreMapEmbed({
  name,
  genre,
  originName,
  area,
  mapUrl,
  className = "",
  showWalkTime,
  walkMinutes,
}: {
  name: string
  genre: string
  /** ルート起点となるパチンコホール名（ホール詳細ページでは固定） */
  originName: string
  /** マップ検索クエリの地域語（例: "秋葉原"） */
  area: string
  /** 明示的に上書きしたい場合のみ指定。未指定なら originName→name のルートURLを自動生成 */
  mapUrl?: string
  className?: string
  showWalkTime?: boolean
  walkMinutes?: number
}) {
  const [hasError, setHasError] = useState(false)

  const embedUrl = mapUrl || generateRouteEmbedUrl(originName, name, area)
  const fallbackStyle =
    genreFallbackStyles[genre as keyof typeof genreFallbackStyles] ||
    genreFallbackStyles["ラーメン"]
  const canShowIframe = Boolean(embedUrl) && !hasError

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {canShowIframe ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 pointer-events-none"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${originName}から${name}へのルート地図`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${fallbackStyle.gradient} flex flex-col items-center justify-center`}
        >
          <span className="text-3xl sm:text-4xl mb-1">{fallbackStyle.emoji}</span>
          <span className="text-white text-[8px] sm:text-[10px] font-medium opacity-80 px-2 text-center truncate max-w-full">
            {name.length > 12 ? name.slice(0, 12) + "..." : name}
          </span>
        </div>
      )}

      {showWalkTime && walkMinutes !== undefined && (
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded z-10 shadow">
          徒歩{walkMinutes}分
        </div>
      )}
    </div>
  )
}

/**
 * パチンコホール地図埋め込み。
 * 単一地点を「ホール名 + エリア名」で検索表示する。
 */
function PachinkoHallMapEmbed({
  name,
  area,
  mapUrl,
  className = "",
}: {
  name: string
  /** マップ検索クエリの地域語 */
  area: string
  /** 明示的に上書きしたい場合のみ指定。未指定なら name + area から自動生成 */
  mapUrl?: string
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const fallbackStyle = genreFallbackStyles["パチンコ"]

  const embedUrl = mapUrl || generateMapEmbedUrl(name, area)
  const canShowIframe = Boolean(embedUrl) && !hasError

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {canShowIframe ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${name}の地図`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${fallbackStyle.gradient} flex flex-col items-center justify-center`}
        >
          <Store className="w-8 h-8 sm:w-12 sm:h-12 text-white mb-1" />
          <span className="text-white text-[10px] sm:text-xs font-medium opacity-90">
            {name}
          </span>
        </div>
      )}
    </div>
  )
}

/** サイドバーのおすすめ店舗表示用ジャンル画像（グラデーション + 絵文字） */
function GenreImage({ genre, className = "" }: { genre: string; className?: string }) {
  const fallbackStyle =
    genreFallbackStyles[genre as keyof typeof genreFallbackStyles] ||
    genreFallbackStyles["ラーメン"]

  return (
    <div
      className={`bg-gradient-to-br ${fallbackStyle.gradient} flex items-center justify-center ${className}`}
    >
      <span className="text-2xl">{fallbackStyle.emoji}</span>
    </div>
  )
}

// ============================================================
// メイン：ホール詳細ページ
// ============================================================

export default function HallDetailClient({
  hall,
  children,
}: {
  hall: PachinkoHall
  children?: ReactNode
}) {
  const [selectedTime, setSelectedTime] = useState<string[]>([])
  // サイトの掲載ポリシーが「徒歩10分以内」のため、初期表示も全件見える 10min を既定とする。
  // 5分以内に絞り込みたい場合はユーザーが明示的に "5min" を選択する。
  const [selectedWalk, setSelectedWalk] = useState("10min")
  const [selectedGenre, setSelectedGenre] = useState<string>("all")
  const { loaded, isFavorite, toggleFavorite } = useFavoriteHalls()
  const hallIsFavorite = loaded && isFavorite(hall.id)
  const chain = getChainForHall(hall)

  const toggleTime = (id: string) => {
    setSelectedTime((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  // フィルター処理
  const filteredRestaurants = useMemo(() => {
    return hall.restaurants.filter((r) => {
      if (selectedGenre !== "all" && r.genre !== selectedGenre) return false

      const walkFilter = walkFilters.find((f) => f.id === selectedWalk)
      if (walkFilter && r.walkMinutes > walkFilter.maxMinutes) return false

      if (selectedTime.length > 0) {
        const hasMatchingTime = selectedTime.some((time) =>
          r.time_category.includes(time as never),
        )
        if (!hasMatchingTime) return false
      }

      return true
    })
  }, [hall.restaurants, selectedGenre, selectedWalk, selectedTime])

  const recommendedRestaurants = useMemo(
    () => selectRecommendedRestaurantsTop3(hall.restaurants),
    [hall.restaurants],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Image
                src="/favicon.png"
                alt="パチ屋飯"
                width={1254}
                height={1254}
                className="w-10 h-10 sm:w-12 sm:h-12 shrink-0"
              />
              <div>
                <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">
                  パチ屋飯
                </h1>
                <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight hidden sm:block">
                  パチンコ客のためのごはんスポット検索
                </p>
              </div>
            </Link>

            {/* デスクトップ: 検索バー */}
            <div className="flex-1 max-w-md hidden md:block">
              <HallSearchForm buttonClassName="px-6" />
            </div>

            {/* デスクトップ: ナビゲーション */}
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-600 shrink-0">
              <button className="flex items-center gap-1 hover:text-gray-900">
                <MapPin className="w-4 h-4" />
                <span>都道府県から探す</span>
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(hall.id)}
                aria-label={hallIsFavorite ? "お気に入りから削除" : "お気に入りに追加"}
                aria-pressed={hallIsFavorite}
                className={`flex items-center gap-1 hover:text-gray-900 ${
                  hallIsFavorite ? "text-red-500" : ""
                }`}
              >
                <Heart className={`w-4 h-4 ${hallIsFavorite ? "fill-current" : ""}`} />
                <span>お気に入り</span>
              </button>
            </div>

            {/* モバイル: アイコンのみ */}
            <div className="flex md:hidden items-center gap-2">
              <button className="p-2 text-gray-600 hover:text-gray-900">
                <Search className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(hall.id)}
                aria-label={hallIsFavorite ? "お気に入りから削除" : "お気に入りに追加"}
                aria-pressed={hallIsFavorite}
                className={`p-2 hover:text-gray-900 ${
                  hallIsFavorite ? "text-red-500" : "text-gray-600"
                }`}
              >
                <Heart className={`w-5 h-5 ${hallIsFavorite ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>

          {/* モバイル: 検索バー */}
          <HallSearchForm
            className="mt-2 md:hidden"
            inputClassName="text-sm h-9"
            buttonClassName="px-4 h-9 text-sm"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {children}

        {/* 店舗情報カード */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* 店舗地図とタイトル（モバイル） */}
            <div className="flex gap-3 sm:hidden">
              <PachinkoHallMapEmbed
                name={hall.name}
                area={hall.area}
                className="w-24 h-20 rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {hall.name}
                  </h2>
                  <FavoriteHallButton hallId={hall.id} iconOnly />
                </div>
                {chain ? (
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-gray-500">チェーン</span>
                    <Link href={getChainPagePath(chain.id)}>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-gray-300 text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                      >
                        {chain.name}
                      </Badge>
                    </Link>
                  </div>
                ) : null}
                <div className="text-[11px] text-gray-600 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{hall.address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{hall.hours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 店舗地図（デスクトップ） */}
            <PachinkoHallMapEmbed
              name={hall.name}
              area={hall.area}
              className="hidden sm:block w-48 h-32 rounded-lg shrink-0"
            />

            {/* 店舗詳細（デスクトップ） */}
            <div className="hidden sm:block flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900">
                    {hall.name}
                  </h2>
                  {chain ? (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-gray-500">チェーン</span>
                      <Link href={getChainPagePath(chain.id)}>
                        <Badge
                          variant="outline"
                          className="text-xs border-gray-300 text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                        >
                          {chain.name}
                        </Badge>
                      </Link>
                    </div>
                  ) : null}
                </div>
                <FavoriteHallButton hallId={hall.id} showLabel />
              </div>

              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{hall.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 text-center text-gray-400 text-xs">🚃</span>
                  <span>{hall.access}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{hall.hours}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-600 border-red-200 text-xs"
                >
                  パチンコ {hall.pachinko}台 / スロット {hall.slot}台
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-red-500">📍</span>
                <span>このページは店舗から徒歩5〜10分圏内の飲食店を掲載しています</span>
              </div>
            </div>

            {/* 地図（デスクトップのみ - 大きな埋め込み地図） */}
            <div className="hidden lg:block relative shrink-0">
              <PachinkoHallMapEmbed
                name={hall.name}
                area={hall.area}
                className="w-64 h-40 bg-gray-100 rounded-lg"
              />
              <div className="absolute bottom-2 right-2 bg-white rounded px-2 py-1 text-xs shadow pointer-events-none">
                徒歩10分圏内
              </div>
            </div>
          </div>

          {/* モバイル: 追加情報 */}
          <div className="sm:hidden mt-3 pt-3 border-t border-gray-100">
            <Badge
              variant="outline"
              className="bg-red-50 text-red-600 border-red-200 text-[10px]"
            >
              パチンコ {hall.pachinko}台 / スロット {hall.slot}台
            </Badge>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 mt-2">
              <span className="text-red-500">📍</span>
              <span>徒歩5〜10分圏内の飲食店を掲載</span>
            </div>
          </div>
        </div>

        {hall.pachiya_comment ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
              パチ屋飯コメント
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {hall.pachiya_comment}
            </p>
          </div>
        ) : null}

        {/* フィルターセクション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4">
            {/* 時間帯で探す */}
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
                時間帯で探す
              </h3>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {timeFilters.map((filter) => {
                  const Icon = filter.icon
                  const isSelected = selectedTime.includes(filter.id)
                  return (
                    <button
                      key={filter.id}
                      onClick={() => toggleTime(filter.id)}
                      className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-gray-700 border-gray-300 hover:border-red-300"
                      }`}
                    >
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="sm:hidden">{filter.shortLabel}</span>
                      <span className="hidden sm:inline">{filter.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 徒歩時間で絞る */}
            <div className="shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
                徒歩時間で絞る
              </h3>
              <div className="flex gap-1.5 sm:gap-2">
                {walkFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedWalk(filter.id)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm transition-colors whitespace-nowrap ${
                      selectedWalk === filter.id
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-red-300"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ジャンルで探す */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">
              ジャンルで探す
            </h3>
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {genreFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedGenre(filter.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 ${
                    selectedGenre === filter.id
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-red-300"
                  }`}
                >
                  <span className="text-sm sm:text-base">{filter.icon}</span>
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 検索結果 */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* メインコンテンツ */}
          <div className="flex-1 order-2 lg:order-1">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">
              検索結果（{filteredRestaurants.length}件）
            </h3>

            <div className="space-y-3 sm:space-y-4">
              {filteredRestaurants.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    条件に一致する飲食店が見つかりませんでした。
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    フィルター条件を変更してお試しください。
                  </p>
                </div>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    id={`restaurant-${restaurant.id}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow scroll-mt-24"
                  >
                    {/* 地図埋め込み部分（ホール → 飲食店 ルート表示） */}
                    <StoreMapEmbed
                      name={restaurant.name}
                      genre={restaurant.genre}
                      originName={hall.name}
                      area={hall.area}
                      className="w-full h-32 sm:h-40"
                      showWalkTime
                      walkMinutes={restaurant.walkMinutes}
                    />

                    {/* 詳細部分 */}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                            <span className="text-[10px] sm:text-xs text-gray-500">
                              {restaurant.time_category.join("・")}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] sm:text-xs border-gray-300 px-1.5 py-0"
                            >
                              {restaurant.genre}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1 break-words">
                            {restaurant.name}
                          </h4>
                        </div>
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-1" />
                      </div>

                      <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2 break-words">
                        {restaurant.ai_summary}
                      </p>

                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 mb-2">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{restaurant.hours}</span>
                      </div>

                      {/* タグ */}
                      <div className="flex gap-1 sm:gap-2 flex-wrap mb-3">
                        {restaurant.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Googleマップルート案内ボタン（ホール → 飲食店 / 徒歩） */}
                      <a
                        href={getGoogleMapsDirectionUrl(
                          hall.name,
                          restaurant.name,
                          hall.area,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors w-full break-words"
                      >
                        <Navigation className="w-4 h-4 shrink-0" />
                        <span>道順を調べる</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* サイドバー */}
          <div className="w-full lg:w-72 shrink-0 space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* おすすめ店舗TOP3 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-1">
                このホール周辺のおすすめ店舗TOP3
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4">
                徒歩で行きやすい店舗を中心に表示しています。
              </p>
              {recommendedRestaurants.length === 0 ? (
                <p className="text-xs text-gray-500">
                  掲載中の飲食店がありません。
                </p>
              ) : (
                <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                  {recommendedRestaurants.map(
                    ({ rank, restaurant, estimatedWalkMinutes }) => (
                      <a
                        key={restaurant.id}
                        href={`#restaurant-${restaurant.id}`}
                        className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-[200px] lg:min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <div className="relative shrink-0">
                          <GenreImage
                            genre={restaurant.genre}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg"
                          />
                          <div
                            className={`absolute -top-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white ${
                              rank === 1
                                ? "bg-yellow-500"
                                : rank === 2
                                  ? "bg-gray-400"
                                  : "bg-amber-700"
                            }`}
                          >
                            {rank}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {restaurant.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            {restaurant.genre}
                          </p>
                          <p className="text-[10px] sm:text-xs text-red-500">
                            徒歩{estimatedWalkMinutes}分
                          </p>
                          {restaurant.hours ? (
                            <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">
                              {restaurant.hours}
                            </p>
                          ) : null}
                        </div>
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* こんなシーンで使えます */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-red-500 mb-3 sm:mb-4">
                こんなシーンで使えます
              </h3>
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">
                      抽選前の朝ごはん
                    </p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">
                      朝から営業しているお店をチェック
                    </p>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">
                      昼休憩のランチ
                    </p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">
                      サクッと食べてすぐ戻れるお店
                    </p>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">
                      閉店後の夜ごはん
                    </p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">
                      23時以降も営業しているお店
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター注釈 */}
        <p className="text-[10px] sm:text-xs text-gray-500 mt-6 sm:mt-8 mb-4">
          ※営業時間やメニュー内容は変更されている場合があります。ご来店前に各店舗へご確認ください。
        </p>
      </main>
    </div>
  )
}
