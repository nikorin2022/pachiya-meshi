# data/

パチンコホール / 飲食店データの**人手投入用ソース**。
ここの JSON を `npm run generate:halls` で読み込み、
`lib/halls/_generated/` 配下に TypeScript を生成する。

## ディレクトリ構成

```
data/
├── areas.json                    # エリアマスタ (akihabara, ueno, ...)
├── chains.json                   # ホールチェーンマスタ (island, espace, ...)
├── prefectures/
│   └── <pref>/                  # 都道府県スラグ (tokyo, kanagawa, ...)
│       ├── halls.json           # その県のホール一覧
│       └── restaurants.json     # その県の飲食店一覧
└── overrides/
    ├── walk-minutes.json        # 推定徒歩分の例外修正
    └── ai-summary.json          # ホール固有の ai_summary 上書き
```

## lat / lng 入力ポリシー（重要）

**Phase C 移行期間中、すべての lat / lng は住所ベースの「推定値」**である。
Google Maps API 等での実測値ではない。±50〜100 m 程度の誤差を想定すること。

将来 Google Places API 等で実測値に差し替える場合は、各エントリの `lat`
/ `lng` を直接書き換えるだけで反映される（generator が再生成時に取り込む）。

推定値であることが原因で `walkMinutes` の自動計算が legacy データと乖離する
場合は、`overrides/walk-minutes.json` で個別に補正する。許容範囲は ±2 分まで。

## restaurants.json の `legacy_id`

既存 `lib/halls/*.ts` の手書きデータと diff 検証するための一時フィールド。
Phase B 移行で `Restaurant.id` を string slug に切り替えた時点で削除する。

新規追加する店舗には `legacy_id` を付与しなくてよい。

## チェーンスラグ命名規則

- 小文字英数 + ハイフン (kebab-case)
- 個人経営・小規模独立ホールは `chain_id` を省略してよい

## エリアスラグ命名規則

- ローマ字表記の地域名 (akihabara, ueno, ikebukuro)
- 1 都道府県内で重複しないこと
