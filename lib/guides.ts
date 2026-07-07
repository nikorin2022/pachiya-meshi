/** ガイド一覧ページのパス */
export const GUIDE_INDEX_PATH = "/guides"

/** 読み物（ガイド）ページの sitemap 登録用パス一覧 */
export const GUIDE_PAGE_PATHS = [
  "/guides/expedition-meal",
  "/guides/morning-cafe",
  "/guides/akihabara-pachiya-meshi",
  "/guides/kitaichimeshi",
  "/guides/manmai-meshi",
] as const

/** ガイド一覧ページ用のエントリ（タイトル・説明・リンク先） */
export const GUIDE_ENTRIES = [
  {
    path: "/guides/akihabara-pachiya-meshi",
    title: "秋葉原パチ屋飯ガイド",
    description:
      "秋葉原エリアでパチンコ・パチスロの合間に使いやすい飲食店の探し方をまとめたガイド。",
  },
  {
    path: "/guides/kitaichimeshi",
    title: "期待値飯ガイド",
    description:
      "パチ屋飯における「期待値飯」の考え方や、掲載基準を紹介するガイド。",
  },
  {
    path: "/guides/manmai-meshi",
    title: "万枚飯ガイド",
    description:
      "長時間稼働や大勝ち後の食事選びに役立つ、しっかり食べたい方向けのガイド。",
  },
  {
    path: "/guides/morning-cafe",
    title: "朝飯ガイド",
    description:
      "朝の入場前や抽選前後に使いやすい食事選びの考え方をまとめたガイド。",
  },
  {
    path: "/guides/expedition-meal",
    title: "遠征飯ガイド",
    description:
      "遠征先でホール周辺の食事を探すときの考え方をまとめたガイド。",
  },
] as const
