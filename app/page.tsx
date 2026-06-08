"use client"

import { useState, useMemo } from "react"
import { Search, MapPin, Heart, Clock, ChevronRight, Sun, Utensils, Moon, Navigation, ExternalLink, Store } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// 時間帯フィルター
const timeFilters = [
  { id: "朝", label: "朝飯", shortLabel: "朝", icon: Sun },
  { id: "昼", label: "昼飯", shortLabel: "昼", icon: Utensils },
  { id: "夜", label: "夜飯", shortLabel: "夜", icon: Moon },
]

// 徒歩時間フィルター
const walkFilters = [
  { id: "5min", label: "5分以内", maxMinutes: 5 },
  { id: "10min", label: "10分以内", maxMinutes: 10 },
]

// ジャンルフィルター
const genreFilters = [
  { id: "all", label: "すべて", icon: "🍴" },
  { id: "ラーメン", label: "ラーメン", icon: "🍜" },
  { id: "カレー", label: "カレー", icon: "🍛" },
  { id: "とんかつ/カツ丼", label: "とんかつ", icon: "🍱" },
  { id: "そば/うどん", label: "そば", icon: "🍝" },
  { id: "丼もの", label: "丼もの", icon: "🍚" },
]

// ジャンル別フォールバックスタイル
const genreFallbackStyles: Record<string, { gradient: string; emoji: string }> = {
  "ラーメン": { gradient: "from-orange-400 to-red-500", emoji: "🍜" },
  "カレー": { gradient: "from-yellow-400 to-orange-500", emoji: "🍛" },
  "とんかつ/カツ丼": { gradient: "from-amber-400 to-yellow-600", emoji: "🍱" },
  "そば/うどん": { gradient: "from-stone-400 to-amber-600", emoji: "🍝" },
  "丼もの": { gradient: "from-red-400 to-orange-500", emoji: "🍚" },
  "パチンコ": { gradient: "from-blue-500 to-purple-600", emoji: "🎰" },
}

// Googleマップ埋め込みURLを生成する関数（店舗名ベース）
const generateMapEmbedUrl = (name: string) => {
  const query = encodeURIComponent(`${name} 秋葉原`)
  return `https://maps.google.com/maps?q=${query}&output=embed&z=17`
}

// Googleマップ ルート埋め込みURLを生成する関数（パチンコホール → 飲食店）店舗名ベース
const generateRouteEmbedUrl = (originName: string, destinationName: string) => {
  const origin = encodeURIComponent(`${originName} 秋葉原`)
  const destination = encodeURIComponent(`${destinationName} 秋葉原`)
  return `https://maps.google.com/maps?saddr=${origin}&daddr=${destination}&dirflg=w&output=embed`
}

// パチンコホールのデータ
const pachinkoHall = {
  name: "アイランド秋葉原店",
  address: "東京都千代田区外神田1-10-1",
  access: "JR秋葉原駅から徒歩2分 / 東京メトロ末広町駅から徒歩5分",
  hours: "10:00〜23:00",
  pachinko: 450,
  slot: 380,
  mapUrl: "https://maps.google.com/maps?q=アイランド秋葉原店+秋葉原&output=embed&z=17",
}

// 秋葉原の飲食店データ（15店舗）- ルート埋め込みURL付き
const restaurants = [
  {
    id: 1,
    name: "麺処 ほん田 秋葉原本店",
    genre: "ラーメン",
    walkMinutes: 5,
    time_category: ["昼", "夜"],
    hours: "11:30〜15:00、18:00〜21:00",
    ai_summary: "都内屈指の有名店。並びは激しいが、大勝ちした日の最高のご褒美麺として完璧なクオリティ。",
    tags: ["ガッツリ", "一人OK"],
    address: "東京都千代田区外神田3-7-2",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=麺処+ほん田+秋葉原本店+東京都千代田区外神田3-7-2&dirflg=w&output=embed",
  },
  {
    id: 2,
    name: "青島食堂 秋葉原店",
    genre: "ラーメン",
    walkMinutes: 9,
    time_category: ["昼", "夜"],
    hours: "11:00〜17:00（売切次第終了）",
    ai_summary: "生姜醤油のスープが体に染み渡る大行列店。夕方に早閉まいすることが多いため、実質昼休憩か早番終わりの一択。",
    tags: ["ガッツリ", "一人OK"],
    address: "東京都千代田区神田須田町2-12-5",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=青島食堂+秋葉原店+東京都千代田区神田須田町2-12-5&dirflg=w&output=embed",
  },
  {
    id: 3,
    name: "秋葉原 ラーメン わいず",
    genre: "ラーメン",
    walkMinutes: 6,
    time_category: ["昼", "夜"],
    hours: "10:30〜22:00",
    ai_summary: "濃厚でガツンとくる家系ラーメン。終日営業しているため、どの時間帯の休憩でも立ち寄りやすい。",
    tags: ["サク飯", "ガッツリ", "一人OK"],
    address: "東京都千代田区外神田3-2-13",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=秋葉原+ラーメン+わいず+東京都千代田区外神田3-2-13&dirflg=w&output=embed",
  },
  {
    id: 4,
    name: "博多風龍 秋葉原総本店",
    genre: "ラーメン",
    walkMinutes: 1,
    time_category: ["昼", "夜"],
    hours: "11:00〜翌2:00",
    ai_summary: "アイランドから目と鼻の先。提供が爆速かつ替玉2玉無料なので、45分休憩をフルに活かせる定番中の定番。",
    tags: ["サク飯", "ガッツリ", "一人OK", "深夜OK"],
    address: "東京都千代田区外神田1-10-11",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=博多風龍+秋葉原総本店+東京都千代田区外神田1-10-11&dirflg=w&output=embed",
  },
  {
    id: 5,
    name: "カレーは飲み物。秋葉原店",
    genre: "カレー",
    walkMinutes: 7,
    time_category: ["昼", "夜"],
    hours: "11:00〜16:00、17:30〜21:30",
    ai_summary: "トッピングが3つ選べる濃厚カレー。提供スピードが早く、ガッツリ食べてすぐホールに戻りたい時に最適。",
    tags: ["サク飯", "ガッツリ", "一人OK"],
    address: "東京都千代田区外神田3-10-5",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=カレーは飲み物+秋葉原店+東京都千代田区外神田3-10-5&dirflg=w&output=embed",
  },
  {
    id: 6,
    name: "カレーの市民 アルバ 秋葉原本店",
    genre: "カレー",
    walkMinutes: 3,
    time_category: ["昼", "夜"],
    hours: "11:00〜21:30",
    ai_summary: "アイランド裏手のサボニウス広場近く。濃厚な金沢カレーで、サクッとエネルギー補給をするのに便利。",
    tags: ["サク飯", "ガッツリ", "一人OK"],
    address: "東京都千代田区外神田1-6-7",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=カレーの市民+アルバ+秋葉原本店+東京都千代田区外神田1-6-7&dirflg=w&output=embed",
  },
  {
    id: 7,
    name: "カリガリ 秋葉原",
    genre: "カレー",
    walkMinutes: 6,
    time_category: ["昼", "夜"],
    hours: "11:30〜23:00",
    ai_summary: "神田カレーグランプリ優勝店。お洒落な空間ながら、スパイスの効いたカレーで脳をリフレッシュできる。",
    tags: ["一人OK", "深夜OK"],
    address: "東京都千代田区外神田6-14-2",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=カリガリ+秋葉原+東京都千代田区���神田6-14-2&dirflg=w&output=embed",
  },
  {
    id: 8,
    name: "丸五",
    genre: "とんかつ/カツ丼",
    walkMinutes: 4,
    time_category: ["昼", "夜"],
    hours: "11:30〜14:00、17:00〜20:00",
    ai_summary: "行列必至のミシュラン掲載店。「勝負に勝つ」ゲン担ぎや、大勝利した日の贅沢ディナーにふさわしい名店。",
    tags: ["ガッツリ", "一人OK"],
    address: "東京都千代田区外神田1-8-14",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=丸五+秋葉原+とんかつ+東京都千代田区外神田1-8-14&dirflg=w&output=embed",
  },
  {
    id: 9,
    name: "とんかつ 檍 秋葉原店",
    genre: "とんかつ/カツ丼",
    walkMinutes: 7,
    time_category: ["昼", "夜"],
    hours: "11:00〜15:00、17:00〜21:00",
    ai_summary: "レア気味に揚げられた極厚のSPF豚が絶品。軍資金に余裕がある時の贅沢飯としておすすめ。",
    tags: ["ガッツリ", "一人OK"],
    address: "東京都千代田区外神田3-6-4",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=とんかつ+檍+秋葉原店+東京都千代田区外神田3-6-4&dirflg=w&output=embed",
  },
  {
    id: 10,
    name: "名代 富士そば 秋葉原電気街店",
    genre: "そば/うどん",
    walkMinutes: 2,
    time_category: ["朝", "昼", "夜"],
    hours: "24時間営業",
    ai_summary: "アイランド目の前の電気街口すぐ。24時間営業のため、抽選前の朝食から閉店後の夜食までいつでも使える絶対的安心感。",
    tags: ["サク飯", "一人OK", "深夜OK", "朝飯OK"],
    address: "東京都千代田区外神田1-15-18",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=名代+富士そば+秋葉原電気街店+東京都千代田区外神田1-15-18&dirflg=w&output=embed",
  },
  {
    id: 11,
    name: "小諸そば 秋葉原店",
    genre: "そば/うどん",
    walkMinutes: 4,
    time_category: ["朝", "昼", "夜"],
    hours: "6:30〜22:00",
    ai_summary: "安くて早くて旨い立ち食いそば。並びから実食まで10分以内で完結するため、短時間の昼休憩に重宝する。",
    tags: ["サク飯", "一人OK", "朝飯OK"],
    address: "東京都千代田区外神田1-8-13",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=小諸そば+秋葉原店+東京都千代田区外神田1-8-13&dirflg=w&output=embed",
  },
  {
    id: 12,
    name: "すた丼屋 秋葉原店",
    genre: "丼もの",
    walkMinutes: 3,
    time_category: ["昼", "夜"],
    hours: "11:00〜23:00",
    ai_summary: "ジャンクでニンニクの効いた伝説のすた丼。圧倒的スピード提供と強烈な塩分・総カロリーで、疲れた脳に活力を注入できる。",
    tags: ["サク飯", "ガッツリ", "一人OK", "深夜OK"],
    address: "東京都千代田区外神田4-4-3",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=すた丼屋+秋葉原店+東京都千代田区外神田4-4-3&dirflg=w&output=embed",
  },
  {
    id: 13,
    name: "ローストビーフ大野 秋葉原店",
    genre: "丼もの",
    walkMinutes: 3,
    time_category: ["昼", "夜"],
    hours: "11:00〜22:00",
    ai_summary: "アイランドと同じ通り沿いにある、山盛りのローストビーフ丼店。終日並びが激しいため、時間に余裕がある時の贅沢向け。",
    tags: ["ガッツリ", "一人OK"],
    address: "東京都千代田区外神田1-10-5",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=ローストビーフ大野+秋葉原店+東京都千代田区外神田1-10-5&dirflg=w&output=embed",
  },
  {
    id: 14,
    name: "肉の万世 秋葉原本店",
    genre: "丼もの",
    walkMinutes: 7,
    time_category: ["昼", "夜"],
    hours: "11:00〜22:00",
    ai_summary: "秋葉原の肉の聖地。ボリューム満点の万かつサンドのテイクアウトや、パチスロ大勝ち時の「万枚祝い」のディナーに最適。",
    tags: ["ガッツリ"],
    address: "東京都千代田区神田須田町2-21",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=肉の万世+秋葉原本店+東京都千代田区神田須田町2-21&dirflg=w&output=embed",
  },
  {
    id: 15,
    name: "岡むら屋 秋葉原店",
    genre: "丼もの",
    walkMinutes: 4,
    time_category: ["昼", "夜"],
    hours: "10:00〜22:30",
    ai_summary: "じっくり煮込まれた大ぶりの角切り肉が乗った「肉めし」が特徴。提供が早く、ガッツリ肉をかき込みたい時に重宝する。",
    tags: ["サク飯", "ガッツリ", "一人OK"],
    address: "東京都千代田区外神田3-14-3",
    mapUrl: "https://maps.google.com/maps?saddr=アイランド秋葉原店&daddr=岡むら屋+秋葉原店+東京都千代田区外神田3-14-3&dirflg=w&output=embed",
  },
]

// Googleマップのルート案内URLを生成する関数
const getGoogleMapsDirectionUrl = (name: string, address: string) => {
  const destination = encodeURIComponent(`${name} ${address}`)
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

// Googleマップ埋め込みコンポーネント（飲食店用）
function StoreMapEmbed({ 
  name, 
  genre, 
  address,
  mapUrl,
  className = "",
  showWalkTime,
  walkMinutes,
}: { 
  name: string
  genre: string
  address: string
  mapUrl?: string
  className?: string
  showWalkTime?: boolean
  walkMinutes?: number
}) {
  const [hasError, setHasError] = useState(false)
  
  // mapUrlがない場合は自動生成
  const embedUrl = mapUrl || generateMapEmbedUrl(name, address)
  const fallbackStyle = genreFallbackStyles[genre] || genreFallbackStyles["ラーメン"]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!hasError ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 pointer-events-none"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${name}の地図`}
          onError={() => setHasError(true)}
        />
      ) : (
        /* フォールバック表示 */
        <div className={`w-full h-full bg-gradient-to-br ${fallbackStyle.gradient} flex flex-col items-center justify-center`}>
          <span className="text-3xl sm:text-4xl mb-1">{fallbackStyle.emoji}</span>
          <span className="text-white text-[8px] sm:text-[10px] font-medium opacity-80 px-2 text-center truncate max-w-full">
            {name.length > 12 ? name.slice(0, 12) + "..." : name}
          </span>
        </div>
      )}
      
      {/* 徒歩時間バッジ */}
      {showWalkTime && walkMinutes !== undefined && (
        <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded z-10 shadow">
          徒歩{walkMinutes}分
        </div>
      )}
    </div>
  )
}

// パチンコホール地図埋め込みコンポーネント
function PachinkoHallMapEmbed({ 
  name, 
  mapUrl,
  className = "" 
}: { 
  name: string
  mapUrl?: string
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const fallbackStyle = genreFallbackStyles["パチンコ"]

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {mapUrl && !hasError ? (
        <iframe
          src={mapUrl}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${name}の地図`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${fallbackStyle.gradient} flex flex-col items-center justify-center`}>
          <Store className="w-8 h-8 sm:w-12 sm:h-12 text-white mb-1" />
          <span className="text-white text-[10px] sm:text-xs font-medium opacity-90">{name}</span>
        </div>
      )}
    </div>
  )
}

// ジャンル���像コンポーネント（サイドバー用）
function GenreImage({ genre, className = "" }: { genre: string; className?: string }) {
  const fallbackStyle = genreFallbackStyles[genre] || genreFallbackStyles["ラーメン"]
  
  return (
    <div className={`bg-gradient-to-br ${fallbackStyle.gradient} flex items-center justify-center ${className}`}>
      <span className="text-2xl">{fallbackStyle.emoji}</span>
    </div>
  )
}

export default function PachinkoMeshiNavi() {
  const [selectedTime, setSelectedTime] = useState<string[]>([])
  const [selectedWalk, setSelectedWalk] = useState("5min")
  const [selectedGenre, setSelectedGenre] = useState("all")
  const [isFavorite, setIsFavorite] = useState(false)

  const toggleTime = (id: string) => {
    setSelectedTime(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  // フィルター処理
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      // ジャンルフィルター
      if (selectedGenre !== "all" && r.genre !== selectedGenre) return false
      
      // 徒歩時間フィルター
      const walkFilter = walkFilters.find(f => f.id === selectedWalk)
      if (walkFilter && r.walkMinutes > walkFilter.maxMinutes) return false
      
      // 時間帯フィルター（選択されている場合のみ適用）
      if (selectedTime.length > 0) {
        const hasMatchingTime = selectedTime.some(time => r.time_category.includes(time))
        if (!hasMatchingTime) return false
      }
      
      return true
    })
  }, [selectedGenre, selectedWalk, selectedTime])

  // 人気ジャンルTOP3を計算
  const popularGenres = useMemo(() => {
    const genreCounts: Record<string, number> = {}
    restaurants.forEach(r => {
      genreCounts[r.genre] = (genreCounts[r.genre] || 0) + 1
    })
    
    return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry, index) => ({
        rank: index + 1,
        name: entry[0],
        count: entry[1],
      }))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          {/* モバイル: ロゴとメニュー */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[10px] sm:text-xs font-bold">飯</span>
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">パチンコ飯ナビ</h1>
                <p className="text-[8px] sm:text-[10px] text-gray-500 leading-tight hidden sm:block">パチンコ客のためのごはんスポット検索</p>
              </div>
            </div>
            
            {/* デスクトップ: 検索バー */}
            <div className="flex-1 max-w-md hidden md:block">
              <div className="flex">
                <Input 
                  placeholder="パチンコ店名を入力" 
                  className="rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button className="rounded-l-none bg-blue-600 hover:bg-blue-700 text-white px-6">
                  検索
                </Button>
              </div>
            </div>

            {/* デスクトップ: ナビゲーション */}
            <div className="hidden md:flex items-center gap-4 text-sm text-gray-600 shrink-0">
              <button className="flex items-center gap-1 hover:text-gray-900">
                <MapPin className="w-4 h-4" />
                <span>都道府県から探す</span>
              </button>
              <button className="flex items-center gap-1 hover:text-gray-900">
                <Heart className="w-4 h-4" />
                <span>お気に入り</span>
              </button>
            </div>

            {/* モバイル: アイコンのみ */}
            <div className="flex md:hidden items-center gap-2">
              <button className="p-2 text-gray-600 hover:text-gray-900">
                <Search className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* モバイル: 検索バー */}
          <div className="mt-2 md:hidden">
            <div className="flex">
              <Input 
                placeholder="パチンコ店名を入力" 
                className="rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-9"
              />
              <Button className="rounded-l-none bg-blue-600 hover:bg-blue-700 text-white px-4 h-9 text-sm">
                検索
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {/* パンくずリスト */}
        <nav className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap">
          <span>ホーム</span>
          <span className="mx-1">&gt;</span>
          <span>東京都</span>
          <span className="mx-1">&gt;</span>
          <span>秋葉原区</span>
          <span className="mx-1">&gt;</span>
          <span className="text-gray-900">{pachinkoHall.name}</span>
        </nav>

        {/* 店舗情報カード */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* 店舗地図とタイトル（モバイル） */}
            <div className="flex gap-3 sm:hidden">
              <PachinkoHallMapEmbed 
                name={pachinkoHall.name}
                mapUrl={pachinkoHall.mapUrl}
                className="w-24 h-20 rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900 truncate">{pachinkoHall.name}</h2>
                  <Button 
                    variant={isFavorite ? "default" : "outline"}
                    size="sm"
                    className={`shrink-0 h-7 px-2 text-xs gap-1 ${isFavorite ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : "text-red-500 border-red-500 hover:bg-red-50"}`}
                    onClick={() => setIsFavorite(!isFavorite)}
                  >
                    <Heart className={`w-3 h-3 ${isFavorite ? "fill-current" : ""}`} />
                  </Button>
                </div>
                <div className="text-[11px] text-gray-600 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{pachinkoHall.address}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{pachinkoHall.hours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 店舗地図（デスクトップ） */}
            <PachinkoHallMapEmbed 
              name={pachinkoHall.name}
              mapUrl={pachinkoHall.mapUrl}
              className="hidden sm:block w-48 h-32 rounded-lg shrink-0"
            />

            {/* 店舗詳細（デスクトップ） */}
            <div className="hidden sm:block flex-1">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900">{pachinkoHall.name}</h2>
                <Button 
                  variant={isFavorite ? "default" : "outline"}
                  size="sm"
                  className={`gap-1 ${isFavorite ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : "text-red-500 border-red-500 hover:bg-red-50"}`}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
                  お気に入り
                </Button>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{pachinkoHall.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 text-center text-gray-400 text-xs">🚃</span>
                  <span>{pachinkoHall.access}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{pachinkoHall.hours}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs">
                  パチンコ {pachinkoHall.pachinko}台 / スロット {pachinkoHall.slot}台
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-red-500">📍</span>
                <span>このページは店舗から徒歩5〜10分圏内の飲食店を掲載しています</span>
              </div>
            </div>

            {/* 地図（デスクトップのみ - 大きな埋め込み地図） */}
            <div className="hidden lg:block w-64 h-40 bg-gray-100 rounded-lg overflow-hidden shrink-0 relative">
              <iframe
                src={pachinkoHall.mapUrl}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${pachinkoHall.name}周辺の地図`}
              />
              <div className="absolute bottom-2 right-2 bg-white rounded px-2 py-1 text-xs shadow pointer-events-none">
                徒歩10分圏内
              </div>
            </div>
          </div>

          {/* モバイル: 追加情報 */}
          <div className="sm:hidden mt-3 pt-3 border-t border-gray-100">
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px]">
              パチンコ {pachinkoHall.pachinko}台 / スロット {pachinkoHall.slot}台
            </Badge>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600 bg-gray-50 rounded-lg px-2 py-1.5 mt-2">
              <span className="text-red-500">📍</span>
              <span>徒歩5〜10分圏内の飲食店を掲載</span>
            </div>
          </div>
        </div>

        {/* フィルターセクション */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          {/* 時間帯・徒歩時間 */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4">
            {/* 時間帯で探す */}
            <div className="flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">時間帯で探す</h3>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {timeFilters.map(filter => {
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
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">徒歩時間で絞る</h3>
              <div className="flex gap-1.5 sm:gap-2">
                {walkFilters.map(filter => (
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
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">ジャンルで探す</h3>
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {genreFilters.map(filter => (
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
                  <p className="text-gray-500 text-sm">条件に一致する飲食店が見つかりませんでした。</p>
                  <p className="text-xs text-gray-400 mt-2">フィルター条件を変更してお試しください。</p>
                </div>
              ) : (
                filteredRestaurants.map(restaurant => (
                  <div 
                    key={restaurant.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* 地図埋め込み部分 */}
                    <StoreMapEmbed 
                      name={restaurant.name}
                      genre={restaurant.genre}
                      address={restaurant.address}
                      mapUrl={restaurant.mapUrl}
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
                            <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-300 px-1.5 py-0">
                              {restaurant.genre}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1 break-words">{restaurant.name}</h4>
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
                        {restaurant.tags.slice(0, 4).map(tag => (
                          <span 
                            key={tag}
                            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      {/* Googleマップルート案内ボタン */}
                      <a
                        href={getGoogleMapsDirectionUrl(restaurant.name, restaurant.address)}
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
            {/* 人気ジャンルTOP3 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-3 sm:mb-4">この店舗の人気ジャンルTOP3</h3>
              <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                {popularGenres.map(genre => (
                  <div key={genre.rank} className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="relative">
                      <GenreImage 
                        genre={genre.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg"
                      />
                      <div className={`absolute -top-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white ${
                        genre.rank === 1 ? "bg-yellow-500" : genre.rank === 2 ? "bg-gray-400" : "bg-amber-700"
                      }`}>
                        {genre.rank}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-xs sm:text-sm">{genre.name}</p>
                      <p className="text-[10px] sm:text-xs text-red-500">{genre.count}件</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-3 sm:mt-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                すべてのジャンルを見る
              </button>
            </div>

            {/* こんなシーンで使えます */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-red-500 mb-3 sm:mb-4">こんなシーンで使えます</h3>
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">抽選前の朝ごはん</p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">朝から営業しているお店をチェック</p>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">昼休憩のランチ</p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">サクッと食べてすぐ戻れるお店</p>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 lg:gap-3 text-center lg:text-left">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-[10px] sm:text-sm">閉店後の夜ごはん</p>
                    <p className="text-[9px] sm:text-xs text-gray-500 hidden lg:block">23時以降も営業しているお店</p>
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
