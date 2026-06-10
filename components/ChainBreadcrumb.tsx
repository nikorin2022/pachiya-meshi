import Link from "next/link"
import type { Chain } from "@/lib/chains"

type Props = {
  chain: Chain
}

/**
 * チェーン詳細ページのパンくずリスト（Server Component）。
 * 表示: ホーム > チェーン一覧 > チェーン名
 */
export function ChainBreadcrumb({ chain }: Props) {
  return (
    <nav
      aria-label="パンくずリスト"
      className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-4 overflow-x-auto whitespace-nowrap"
    >
      <ol className="inline-flex items-center list-none p-0 m-0">
        <li className="inline-flex items-center">
          <Link href="/" className="hover:text-gray-900">
            ホーム
          </Link>
        </li>
        <li className="inline-flex items-center" aria-hidden="true">
          <span className="mx-1">&gt;</span>
        </li>
        <li className="inline-flex items-center">
          <Link href="/chains" className="hover:text-gray-900">
            チェーン一覧
          </Link>
        </li>
        <li className="inline-flex items-center" aria-hidden="true">
          <span className="mx-1">&gt;</span>
        </li>
        <li className="inline-flex items-center">
          <span className="text-gray-900" aria-current="page">
            {chain.name}
          </span>
        </li>
      </ol>
    </nav>
  )
}
