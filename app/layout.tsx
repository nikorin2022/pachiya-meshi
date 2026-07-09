import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { Analytics } from '@vercel/analytics/next'
import { FavoriteHallsProvider } from '@/components/FavoriteHallsProvider'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
/** AdSense サイト所有権確認用（広告表示は未実装） */
const ADSENSE_CLIENT_ID = 'ca-pub-5751363901744371'

export const metadata: Metadata = {
  // 相対パス指定の canonical / OG画像URL を絶対URL化するための基準
  metadataBase: new URL(SITE_URL),
  title: 'パチ屋飯 - パチンコユーザー・パチスロユーザーのためのごはんスポット検索',
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/pachiya-meshi-icon.png',
    shortcut: '/pachiya-meshi-icon.png',
    apple: '/pachiya-meshi-icon.png',
  },
  // OG のサイト共通デフォルト。子ページで title/description/type 等を上書きする。
  // images はサイト全体で pachiya-meshi-hero.webp を SNS シェア用カードに使用する。
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [
      {
        url: '/pachiya-meshi-hero.webp',
        width: 2172,
        height: 724,
        alt: 'パチ屋飯',
      },
    ],
  },
  // Twitter Card: pachiya-meshi-hero.webp を採用したため summary_large_image を使用。
  twitter: {
    card: 'summary_large_image',
    images: ['/pachiya-meshi-hero.webp'],
  },
  // Google Search Console のサイト所有権確認（HTML タグ方式）。
  // Next.js が <head> に <meta name="google-site-verification" content="..." /> を自動出力する。
  // 注意: 認証完了後もこのタグを残しておくこと（削除すると認証が無効化される）。
  verification: {
    google: '-SzQndoi3e8XlT931Eshx-wU-zFbxG2lj6Wp2Jm1rTU',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="bg-gray-50">
      <head>
        {process.env.NODE_ENV === 'production' && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="font-sans antialiased">
        <FavoriteHallsProvider>{children}</FavoriteHallsProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
      {process.env.NODE_ENV === 'production' && GA_ID && (
        <GoogleAnalytics gaId={GA_ID} />
      )}
    </html>
  )
}
