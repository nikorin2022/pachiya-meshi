import Link from "next/link"

const FOOTER_LINKS = [
  { href: "/about", label: "運営者情報" },
  { href: "/guides", label: "ガイド" },
  { href: "/contact", label: "お問い合わせ" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/terms", label: "利用規約" },
] as const

/**
 * サイト共通フッター。固定ページへの導線を提供する。
 */
export function SiteFooter() {
  return (
    <footer className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
      <nav
        aria-label="サイト情報"
        className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] sm:text-xs text-gray-500"
      >
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-gray-900 underline-offset-2 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="text-[10px] sm:text-xs text-gray-400 mt-3">© パチ屋飯</p>
    </footer>
  )
}
