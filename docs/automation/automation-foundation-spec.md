# パチ屋飯 AI 自動運営基礎仕様書（Phase 0・Phase 1）

- 文書状態: Phase 0・Phase 1 実装前の基礎仕様
- 調査日: 2026-07-12
- 対象リポジトリ: `nikorin2022/pachiya-meshi`
- 対象ブランチ: `main`
- 今回の実装範囲: 仕様書作成のみ。監査機能、CI、自動公開は未実装

## 0. 目的と前提

本書は、人間による店舗単位の日常的な目視確認を前提にせず、パチ屋飯を段階的に自動運営へ移行するための安全基準と、既存データを対象にした Phase 1 監査基盤の実装仕様を定める。

自動運営の基本原則は次のとおりとする。

1. 客観的事実は、外部 API または決定論的プログラムで検証する。
2. AI は分類、文章生成、SEO 分析、異常内容の整理に限定し、実在性・住所・座標などの事実判定の単独根拠にしない。
3. 機械的に確認できない情報は公開しない。
4. 不確実な案件は日常的な人手承認へ回さず、自動再調査、隔離、期限後破棄のいずれかにする。
5. 品質ゲートを通過した通常案件だけを、将来の Phase 6 で自動公開対象にする。
6. 同じ入力と設定に対する処理は冪等にする。
7. 特定の AI 開発ツールに運営基盤を依存させない。

Phase 1 では読み取り専用監査までを扱う。元 JSON、生成 TypeScript、本番表示を自動修正しない。Phase 2 以降の機能を先行して有効化しない。

## 1. 現状調査結果

### 1.1 Git・実行環境

| 項目 | 確認結果 |
| --- | --- |
| ブランチ | `main` |
| 作業開始時 | `main...origin/main`、未コミット変更なし |
| remote | `https://github.com/nikorin2022/pachiya-meshi.git` |
| Node.js | ローカル実測 `v24.14.0`。依頼時想定の v22 と差異あり。`package.json` に `engines` 指定なし |
| npm | `11.9.0`。`packageManager` も `npm@11.9.0` |
| フレームワーク | Next.js `16.2.6`、App Router、React 19、TypeScript 5.7.3 |
| 配信 | Vercel。`vercel.json` は `npm ci` と `npm run build` を指定 |
| CI | `.github/` ディレクトリなし。GitHub Actions 未実装 |
| テスト | テストランナー、テスト用 npm script、実テストファイルなし |
| 開発文書 | ルート README なし。データ手順は `data/README.md` のみ |

PowerShell では実行ポリシーにより `npm.ps1` が拒否されたため、調査時は `npm.cmd` / `npx.cmd` を使用した。CI の Linux 環境では通常の `npm` / `npx` 表記を使用してよい。

### 1.2 技術構成とデータの正本

データの正本は以下の JSON である。

- `data/areas.json`: エリアマスタ、40件
- `data/chains.json`: ホールチェーンマスタ、25件
- `data/prefectures/{prefecture}/halls.json`: 6都道府県、合計134ホール
- `data/prefectures/{prefecture}/restaurants.json`: 6都道府県、合計433飲食店
- `data/overrides/walk-minutes.json`: 徒歩分数上書き、3件
- `data/overrides/ai-summary.json`: 紹介文上書き、11件
- `data/overrides/exclusions.json`: ホール×飲食店の掲載除外、3件

都道府県別件数は次のとおり。

| prefecture slug | ホール | 飲食店 |
| --- | ---: | ---: |
| `aichi` | 4 | 12 |
| `fukuoka` | 6 | 16 |
| `hokkaido` | 3 | 7 |
| `miyagi` | 4 | 4 |
| `osaka` | 13 | 27 |
| `tokyo` | 104 | 367 |

`scripts/lib/schema.ts` の Zod スキーマが入力形式を定義し、`scripts/sources/file-source.ts` が JSON の読み込みと配列単位の検証を行う。必須ファイルの欠損、JSON パース失敗、Zod 違反は生成処理を停止する。

### 1.3 実データのスキーマ

#### エリア

`data/areas.json` の確認済みキー:

`id`, `name`, `prefecture`, `description_short?`, `area_description`, `lat?`, `lng?`

#### チェーン

`data/chains.json` の確認済みキー:

`id`, `name`, `official_url?`, `description_short?`, `description`

#### ホール

`data/prefectures/*/halls.json` の確認済みキー:

`id`, `name`, `area_id`, `chain_id?`, `prefecture`, `city`, `address`, `access`, `hours`, `pachinko`, `slot`, `lat`, `lng`, `pachiya_comment`, `meal_guide`

すべての現行ホールで同じキー集合を確認した。`id` は kebab-case、緯度は24〜46、経度は122〜154、説明文には最低文字数が設定されている。

#### 飲食店

`data/prefectures/*/restaurants.json` の確認済みキー:

`id`, `legacy_id?`, `name`, `area_id?`, `genre`, `time_category`, `hours`, `tags`, `address`, `lat`, `lng`, `default_ai_summary`, `is_kitaichimeshi?`, `selection_tags?`, `selection_note?`

現行データは全件 `lat` / `lng` を持つ。`legacy_id` は移行用の一時フィールドで、都道府県内重複は確認されなかったが、都道府県をまたぐ重複グループが9組ある。このため監査の一意性スコープを明示する必要がある。

飲食店カテゴリの正確な現行値は次の8種である。

- `ラーメン`
- `カレー`
- `とんかつ/カツ丼`
- `そば/うどん`
- `丼もの`
- `回転寿司`
- `焼肉`
- `ハンバーガー`

依頼文の「とんかつ・カツ丼」「そば・うどん」とは区切り文字が異なり、実装上の正本は `scripts/lib/schema.ts` と `lib/halls/types.ts` の `/` 表記である。

### 1.4 自動生成処理と生成物

確認した主要ファイル:

- `scripts/generate-prefecture-data.ts`
- `scripts/sources/types.ts`
- `scripts/sources/file-source.ts`
- `scripts/lib/schema.ts`
- `scripts/lib/generator.ts`
- `scripts/lib/master-resolver.ts`
- `scripts/lib/restaurant-matcher.ts`
- `scripts/lib/distance.ts`
- `scripts/lib/hall-builder.ts`
- `scripts/lib/ts-emitter.ts`
- `lib/halls/_generated/{prefecture}.ts`
- `lib/halls/_generated/index.ts`
- `lib/halls/index.ts`

生成フローは以下である。

1. マスタ、overrides、exclusions を読み込む。
2. `data/prefectures/` のサブディレクトリを列挙する。
3. ホール・飲食店 JSON を Zod で検証する。
4. ホールの `area_id` / `chain_id` をマスタに照合する。
5. 同じ都道府県ファイル内の飲食店から、直線800m以下かつ推定徒歩10分以下を抽出する。
6. `walk-minutes.json` と `exclusions.json` を適用する。
7. `ai-summary.json` を適用し、ランタイム型へ変換する。
8. `lib/halls/_generated/*.ts` と集約 `index.ts` を上書き生成する。

距離は `scripts/lib/distance.ts` で Haversine 直線距離を求め、都市迂回係数1.3、徒歩速度80m/分、切り上げで推定する。実歩行ルートではない。

生成物は手動編集禁止である。`lib/halls/index.ts` は現在 `./_generated` をエクスポートしており、生成物は本番サイトの実データとして利用されている。`scripts/lib/ts-emitter.ts` 内の「既存サイトはこの _generated を一切 import しない」というコメントは現状と一致しない。

調査時の `npm run generate:halls` は成功し、134ホール、ホール別に延べ1,384件の飲食店関連を生成した。3ホールは紐づく飲食店0件の警告となった。再生成後に Git 差分はなく、現時点の生成物は正本と一致している。

### 1.5 既存コマンドと検証結果

`package.json` に存在する関連コマンド:

| コマンド | 現在の役割 |
| --- | --- |
| `npm run generate:halls` | JSON から都道府県別 TypeScript を生成 |
| `npm run build` | `prebuild` で生成後、Next.js 本番ビルド |
| `npm run lint` | ESLint。今回の調査では実行していない |
| `npm run dump:halls` | 旧データ比較用ダンプ |
| `npm run diff:halls` | 旧データとの差分確認 |

明示的な npm script はないが、以下を確認した。

- `node scripts/validate-restaurant-data.mjs`: 終了コード0。距離・件数・Maps URLを確認するが、低精度座標を大量に警告。飲食店5件未満17ホール、うち0件3ホール。警告のみでは失敗しない。
- `npx tsc --noEmit -p .`: 成功。ただしルート `tsconfig.json` は `scripts` を除外している。
- `scripts/tsconfig.json`: スクリプト用の型チェック設定は存在するが、npm script や CI に未接続。
- `npm run build`: ネットワーク制限下では Google Fonts 取得失敗。本来のネットワーク許可下では成功し、217ページを生成した。

`next.config.mjs` は `typescript.ignoreBuildErrors: true` であり、Next.js build は型エラーを無視する。したがって型チェックは build と別の必須ゲートにしなければならない。

### 1.6 既存監査資産

利用可能な資産:

- `scripts/validate-restaurant-data.mjs`: 距離、掲載数、低精度座標、Maps URLの論理検証
- `scripts/audit-coordinates-batch.mjs`: 座標精度・重複・掲載利用状況の抽出
- `scripts/audit-maps-coordinates.mjs`: Maps URL、座標、距離の調査レポート生成
- `scripts/audit-maps-dataflow-temp.mjs`: Maps データフロー調査
- `scripts/analyze-validate-warnings.mjs`: 警告の P0〜P4 分類と Markdown レポート
- `scripts/lib/schema.ts`: 入力スキーマ
- `scripts/lib/distance.ts`: 距離計算
- `scripts/lib/restaurant-matcher.ts`: 掲載候補判定
- `lib/maps.ts`: name+address 優先の Maps URL生成と日本国内座標判定
- `app/sitemap.ts`: エリア、チェーン、飲食店1件以上のホールを含む sitemap 生成
- `lib/seo.tsx`: JSON-LD ビルダー

既存監査スクリプトの一部は、実行すると `scripts/*-report.json` や `scripts/reports/*.md` を上書きする。レポートには現在の正本件数と一致しない古いものもあり、生成時刻・入力ハッシュ・schemaVersion を持つ統一レポートが必要である。

### 1.7 現在不足している機能

- 全データを一貫したルール・重要度で監査する単一エントリポイント
- CI が読める安定した JSON レポート
- ホールID、飲食店ID、`legacy_id` の明示的な重複監査
- overrides / exclusions が実在IDを参照しているかの監査
- 正本と生成物の差分ゲート
- 監査スクリプト自身のテストと異常フィクスチャ
- GitHub Actions
- sitemap、内部リンク、JSON-LD、URL件数の独立検証
- 費用上限、停止スイッチ、実行ロック、監査ログ保存ルール
- API・AI・公開処理の再試行、隔離、破棄、ロールバック実装
- 店舗実在性・正式名称・実住所・実歩行距離の根拠となる provenance フィールド
- 「期待値飯」から除外する大規模チェーンの機械可読なリスト。現状は `is_kitaichimeshi` と内部タグはあるが、除外ポリシーはコード・データから確定できない

## 2. 自動運営の段階構成

| Phase | 内容 | 主な依存関係 | 本書での扱い |
| --- | --- | --- | --- |
| 0 | 仕様、安全基準、ログ、費用上限、停止条件 | なし | 詳細仕様を確定 |
| 1 | 既存JSON・生成物・基本サイト構造の読み取り専用監査 | Phase 0 | 詳細仕様と Sprint 1 を確定 |
| 2 | provenance、検証状態、隔離状態などのデータスキーマ拡張 | Phase 1安定 | 概要のみ |
| 3 | 外部APIから候補収集 | Phase 2、API予算・規約 | 概要のみ |
| 4 | 複数根拠による自動検証・採否・再調査 | Phase 3 | 概要のみ |
| 5 | 検証済み事実に基づくAI文章生成 | Phase 4、AI予算 | 概要のみ |
| 6 | PR作成、品質ゲート、段階的自動公開 | Phase 5 | 概要のみ。自動マージは別途承認まで禁止 |
| 7 | 公開後監視、自動ロールバック、自動復旧 | Phase 6、安定したデプロイ識別 | 概要のみ |
| 8 | SEO自動改善 | Phase 7、検索データ | 概要のみ |
| 9 | 収益自動改善 | Phase 7、AdSense合格、Vercel Pro | 概要のみ |
| 10 | 新規エリア自動拡張 | Phase 3〜9の安定運用 | 概要のみ |

後続 Phase は前段の完了条件を満たすまで開始しない。Phase 1 の成果は「公開を増やす仕組み」ではなく「公開してはいけない状態を機械判定できる基盤」である。

## 3. Phase 0 安全基準

### 3.1 自動処理してよい範囲

- リポジトリ内の正本 JSON と生成物の読み取り
- 決定論的な形式、重複、参照、座標、距離、URLの検査
- JSON・Markdown の監査レポート生成
- テスト、型チェック、生成、build の実行
- CI の一時 artifact としてのログ保存
- 変更を伴わない再調査と、同一入力に対する再実行
- Phase 6 以降に別途承認された、検証済みデータだけの候補PR作成

### 3.2 自動処理してはいけない範囲

- 未検証の店舗、住所、座標、営業時間、正式名称の生成または補完
- AI出力だけを根拠とする事実の採用
- 正本 JSON の無承認自動修正
- 生成 TypeScript の直接編集
- AdSense、Vercel、ドメイン、課金、秘密情報の設定変更
- Phase 6 承認前の本番デプロイ、自動マージ、自動公開
- テスト・監査を迂回する変更
- API規約、robots、著作権、個人情報、ポリシー警告に抵触する取得

### 3.3 状態遷移

将来の候補データは次の状態を持つ。Phase 1 ではレポート上の概念として使用し、正本スキーマにはまだ追加しない。

`discovered` → `checking` → `verified` → `publishable` → `published`

異常時の分岐:

- 一時障害: `retry_wait`
- 根拠不足・矛盾: `quarantined`
- 再調査上限到達・期限切れ: `discarded`
- 公開後重大異常: `rolled_back`

### 3.4 自動掲載条件

Phase 6 以降に自動掲載できるのは、次をすべて満たす案件だけとする。

1. 必須事実が決定論的または承認済みAPIで検証済み。
2. 根拠の取得日時・取得元・入力ハッシュを記録済み。
3. 最新の統合監査で `critical=0`、`error=0`。
4. `publishable=true`。
5. 生成、アプリ型チェック、スクリプト型チェック、build、サイト監査が成功。
6. 同一入力で再実行して差分が増殖しない。
7. 費用、レート制限、ポリシー、AdSense作業制限に違反しない。
8. 直前の正常な公開版へ自動復帰できる。

Phase 0・1では自動掲載を常に無効とする。

### 3.5 再調査・隔離・破棄条件

| 処理 | 条件 | 挙動 |
| --- | --- | --- |
| 自動再調査 | API 429/5xx、タイムアウト、一時DNS障害、情報源間の一時的不一致 | 指数バックオフ＋ジッター。最大3回。元データは変更しない |
| 自動隔離 | 実在性不明、住所・座標矛盾、正式名称不明、同一座標大量重複、ポリシー疑い | 公開候補から除外し、根拠と理由をログ化 |
| 自動破棄 | 最大再試行到達、隔離期限30日超、候補の根拠消失、重複候補 | 候補領域だけから削除。公開中データや正本は削除しない |

人間の日常確認を発生させないため、通常の warning は通知しない。自動再調査で解消しない重大例外だけを通知する。

### 3.6 全体停止条件

次のいずれかで、書き込み・公開系処理を全停止する。読み取り専用監査は、監査自体が信用できない場合を除き継続してよい。

- 監査レポートを生成または検証できない
- 正本 JSON の破損、広範な schema 違反、生成物の予期しない大量差分
- `critical` が1件以上
- 認証情報の漏えい疑い、失効、権限過大
- GitHub Actions、Vercel、外部APIの継続障害で安全な判定ができない
- 日次または月次費用上限への到達
- ポリシー、利用規約、セキュリティ警告
- 公開URL数の異常増加、主要ページの広範な消失、重大な内部リンク断裂
- 自動ロールバック失敗
- kill switch が有効

停止状態は自動で書き込み再開しない。認証回復・費用枠更新のように機械判定可能なものだけ、読み取り専用ヘルスチェック成功後に再開候補とする。セキュリティ・ポリシー・ロールバック失敗は人間の明示解除を必要とする。

### 3.7 自動ロールバック条件

Phase 7 以降、公開後に次を検出した場合は直前の正常デプロイへ戻す。

- build またはデプロイ失敗
- 主要URLの5xx、レンダリング不能、JSON-LD構文破損
- `critical` / `error` の新規発生
- URL件数が承認済み差分を超えて急増・急減
- 正本と生成物の不一致
- 公開データの欠落や重複が品質ゲートを超える

ロールバック自体が失敗した場合は全体停止し、人間へ重大例外通知を送る。

### 3.8 障害時の挙動

| 障害 | 自動挙動 | 通知条件 |
| --- | --- | --- |
| 外部API | キャッシュ済み検証結果を改変せず利用期限まで保持。新規候補は再試行後に隔離 | 最大再試行超過か認証失効 |
| AI | 文章生成・分類だけ停止。事実監査は継続。未生成文を公開しない | 連続失敗が運営SLO超過 |
| GitHub Actions | 新規公開・マージを停止。ローカル正本は変更しない | 連続3回失敗、権限・認証異常 |
| Google Fonts等のbuild時外部取得 | build失敗として公開停止。監査結果と区別して記録 | 継続失敗で通知 |
| 費用上限 | 有料API・AI呼び出しを即停止。無料のローカル監査のみ継続 | 上限到達時に1回通知 |

### 3.9 費用上限

Phase 0・1 の外部API・AI予算は0円とする。GitHub Actions無料枠、Vercel Hobby、ローカル実行の範囲で構成する。

Phase 3以降は以下の設定を必須にする。

- 日次上限、月次上限、1実行あたり上限
- 呼び出し回数と推定費用の事前予約
- 80%で warning、100%で有料処理停止
- 上限値が未設定なら fail closed（有料処理を開始しない）

### 3.10 冪等性

- 入力ハッシュ = 対象ファイル内容、監査ルール版、設定版のハッシュ。
- 同じ入力ハッシュでは同じ issue 集合、summary、終了コードを返す。
- `checkedAt` と `duration` だけは変化を許容し、比較時に除外する。
- issue は `code + entityType + entityId + file + 正規化details` から安定IDを導出する。
- レポートは一時ファイルへ完全出力後、原子的に置換する。
- 多重実行は同一ブランチ・同一入力ハッシュ単位のロックで直列化する。
- 監査は元データを変更しない。自動修正候補は提案として記録するだけにする。

### 3.11 ログと監査証跡

Phase 1 の最小ログは構造化JSONとする。秘密情報、APIキー、個人情報、完全な外部レスポンスは保存しない。

保存内容:

- 実行ID、開始・終了時刻、duration
- Git commit SHA、ブランチ、Node/npmバージョン
- 監査schemaVersion、ルール版、設定版
- 入力ファイル一覧とSHA-256
- issue、summary、終了コード、publishable
- 各コマンドの成否。必要時のみ末尾ログ

保存方針:

- CI: GitHub Actions artifact 30日。失敗レポートも保存
- Git履歴: 基準値・ルール・設定だけを保存し、毎回変化する実行レポートは原則コミットしない
- ローカル: `artifacts/automation/` 等のgitignore対象へ出力する設計を Sprint 1 で確定
- 重大例外: issue概要と実行URLを90日以内保存。秘密情報は含めない

### 3.12 個人開発向け最小構成

最小構成は、Node.js、TypeScript/tsx、Zod、npm scripts、GitHub Actions、既存Vercelだけとする。新規DB、キュー、監視SaaS、有料SEOツールを導入しない。状態はGit管理された設定、CI artifact、GitHubの実行履歴で管理し、Phase 3まで外部APIを使わない。

## 4. Phase 1 監査共通仕様

### 4.1 重要度とCI・公開可否

| severity | 定義 | 終了コード | publishable | CI |
| --- | --- | ---: | --- | --- |
| `critical` | 監査自体が信用できない、広範破損、セキュリティ・ポリシー・全体停止条件 | 2 | false | 失敗 |
| `error` | 決定論的なデータ・参照・生成違反。対象を公開不可にする | 1 | false | 失敗 |
| `warning` | 疑わしいが、現行データだけでは誤りと断定できない | 0 | true。ただし将来自動公開の個別条件で隔離可 | 成功 |
| `info` | 件数、品質傾向、未検証事項、改善候補 | 0 | 影響なし | 成功 |

複数重要度がある場合は最も重い終了コードを返す。`status` は `passed`（warningなし）、`passed_with_warnings`（warning/infoのみ）、`failed`（critical/errorあり）の3値とする。

### 4.2 自動修正の原則

Phase 1 は全ルールで元データの自動修正を禁止する。`autoFixable` は「将来、安全な提案を機械生成できるか」を示すだけである。空白除去や配列順序のような決定論的修正でも、Phase 1ではパッチ候補を出すに留める。正式名称、住所、座標、店舗統合、説明文は自動修正不可とする。

## 5. ホール監査仕様

表の「CI」は Phase 1 の既定動作。「自動修正」は将来の提案可否であり、Phase 1では書き換えない。

| code / 監査 | 目的・判定方法 | severity / CI | 自動修正 | 主な誤検知リスク |
| --- | --- | --- | --- | --- |
| `HALL_ID_DUPLICATE` | 全 `halls.json` 横断で `id` をMap集計し2件以上を検出 | error / 失敗 | 不可 | 原則なし。旧別店舗が同IDを意図利用していてもURL衝突するためエラー |
| `HALL_REQUIRED_MISSING` | Zod必須項目、trim後空文字、数値型、配列型を検査 | error / 失敗 | 空白除去のみ提案可 | 営業時間不定を空文字で表す運用。値を推測して補わない |
| `HALL_OFFICIAL_NAME_MISSING` | `name` が空・仮称パターン・ID同値なら検出。公式性そのものは現行データだけで証明不可 | 空はerror、公式性未検証はwarning / errorのみ失敗 | 不可 | 記号・英字・屋号が正式名称の場合 |
| `HALL_ADDRESS_MISSING` | `address.trim()` が空、都道府県・市区町村情報が欠ける | error / 失敗 | 不可 | ビル名なしでも住所として有効な場合 |
| `HALL_COORD_MISSING` | `lat` / `lng` 欠損、null、非数 | error / 失敗 | 不可 | なし。現行schemaでは生成前にZodで停止 |
| `HALL_COORD_FORMAT` | finite number、lat 24〜46、lng 122〜154を検査 | error / 失敗 | 不可 | 離島を含む境界変更。範囲は日本全域の粗い防波堤 |
| `HALL_COORD_SWAPPED` | latが122〜154かつlngが24〜46なら入れ違いと判定 | error / 失敗 | 入替パッチ提案可、適用不可 | 日本国外データ。現行対象は日本限定 |
| `HALL_COORD_OUTSIDE_PREFECTURE` | ファイルslug、`hall.prefecture`、参照areaの都道府県一致をerror。都道府県bounding box外はwarning | 参照矛盾error、地理境界warning / errorのみ失敗 | 不可 | 県境、飛地、粗いbounding box |
| `HALL_COORD_DUPLICATE` | 小数6桁の完全一致と小数4桁丸め群を集計。異なる住所の共有を強く警告 | warning / 成功 | 不可 | 同一建物の本館・別館、複合施設 |
| `HALL_AREA_REF_INVALID` | `area_id` が `areas.json` に存在し、area.prefectureと一致すること | error / 失敗 | 不可 | なし。現生成処理にも一部実装済み |
| `HALL_CHAIN_REF_INVALID` | `chain_id` 指定時に `chains.json` に存在すること | error / 失敗 | 不可 | 独立店は未指定が正しい |
| `HALL_MAP_URL_INVALID` | 保存URLではなく `lib/maps.ts` の生成結果を全ホールで検査。HTTPS、許可host、name+address優先、座標のみへの不意な退行を検出 | error / 失敗 | コード側修正のみ | Google URL仕様変更 |
| `HALL_ID_FORMAT` | `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/` を適用 | error / 失敗 | 正規化候補のみ | ID変更は公開URL変更になるため自動適用不可 |
| `HALL_NAME_DUPLICATE` | 正規化名（NFKC、空白統一、大小文字統一）を同一都道府県で集計 | warning / 成功 | 不可 | 本館・別館の表記差、同名別店舗 |
| `HALL_DESCRIPTION_DUPLICATE` | `pachiya_comment` と `meal_guide` の完全一致をerror、正規化n-gram/Jaccard高類似をwarning | 完全一致error、類似warning / errorのみ失敗 | 不可 | 同チェーン・近接店舗で正当に似る場合 |

ホールの公式名称・実在性を error として確定するには、Phase 2 で公式URL、取得元、確認日時等の provenance が必要である。Phase 1では「空・仮称・重複」は検出できるが、公式性を推測で断定しない。

## 6. 飲食店監査仕様

| code / 監査 | 目的・判定方法 | severity / CI | 自動修正 | 主な誤検知リスク |
| --- | --- | --- | --- | --- |
| `RESTAURANT_ID_DUPLICATE` | 全都道府県横断でstring `id` を集計 | error / 失敗 | 不可 | 原則なし。将来URL・参照衝突になる |
| `RESTAURANT_LEGACY_ID_DUPLICATE` | 都道府県内重複はerror。都道府県間だけの重複は移行仕様上warning | 県内error、県間warning / errorのみ失敗 | 不可 | `legacy_id` は一時互換値でスコープが限定される |
| `RESTAURANT_NAME_DUPLICATE` | 同一都道府県で正規化した店名+住所、店名+座標を集計。完全同一はerror、店名だけはwarning | 条件付きerror/warning / errorのみ失敗 | 不可 | チェーン同名別支店、同一施設内別フロア |
| `RESTAURANT_REQUIRED_MISSING` | Zod必須項目、trim後空文字、配列最小件数を検査 | error / 失敗 | 空白除去のみ提案可 | 営業時間不定の表現 |
| `RESTAURANT_HALL_REF_INVALID` | 現schemaに `hall_id` はない。生成された近接関連とoverrides/exclusionsの `hall_id` / `restaurant_id` が実在するかを検査 | error / 失敗 | 不可 | areaを直接所属関係と誤解しないこと |
| `RESTAURANT_GENRE_INVALID` | 現行8カテゴリとの完全一致 | error / 失敗 | 表記置換候補のみ | 新カテゴリ追加時はschema・UIとの同時変更が必要 |
| `RESTAURANT_ADDRESS_MISSING` | `address.trim()`、都道府県表記、最低限の地域情報を検査 | error / 失敗 | 不可 | 駅構内・施設内で番地表記が特殊 |
| `RESTAURANT_COORD_MISSING` | `lat` / `lng` 欠損、null、非数 | error / 失敗 | 不可 | なし。現行データは全件座標あり |
| `RESTAURANT_COORD_FORMAT` | finite number、lat 24〜46、lng 122〜154 | error / 失敗 | 不可 | 離島境界 |
| `RESTAURANT_COORD_OUTSIDE_PREFECTURE` | ファイルslugとareaの都道府県整合をerror、bounding box外をwarning | 参照矛盾error、地理境界warning / errorのみ失敗 | 不可 | 県境・粗いbounding box |
| `RESTAURANT_COORD_DUPLICATE` | 完全一致・小数4桁群を集計。異なる名称・住所で3件以上共有を強いwarning | warning / 成功 | 不可 | 商業施設内店舗、共通代表座標 |
| `RESTAURANT_DISTANCE_ABNORMAL` | 各ホールとのHaversine距離、800m上限、推定徒歩計算、overrideを再計算し生成結果と比較 | 不整合error、境界付近warning / errorのみ失敗 | 不可 | 直線距離は道路・改札・河川を表さない |
| `RESTAURANT_WALK_OUTSIDE_SUSPECTED` | 推定10分超は生成対象外であることを確認。10分境界、override、障害物リスクをwarning | 不正掲載error、疑いwarning / errorのみ失敗 | 不可 | 実歩行時間はAPIなしでは確定不能 |
| `RESTAURANT_MAP_URL_INVALID` | `lib/maps.ts` のplace/direction URLを生成し、HTTPS、許可host、name+address優先、徒歩modeを検査 | error / 失敗 | コード側修正のみ | Google URL仕様変更 |
| `RESTAURANT_EXCLUDED_CHAIN` | 機械可読な除外リストに一致する店が `is_kitaichimeshi=true` なら検出 | ポリシー確定後error。それまではinfo / 現時点は成功 | フラグ解除候補のみ | 現リポジトリに大規模チェーン除外リストがなく、名称部分一致は危険 |
| `RESTAURANT_SUMMARY_EXACT_DUPLICATE` | `default_ai_summary` とAI overrideを別々に正規化し完全一致群を検出 | 3件以上error、2件warning / 条件付き失敗 | 不可 | 定型的な短文が正当に一致する場合 |
| `RESTAURANT_SUMMARY_SIMILAR` | 文字n-gram/Jaccardまたは決定論的類似度で高類似をwarning。閾値は正常データで校正 | warning / 成功 | 不可 | 同チェーン、同エリア、短文 |
| `RESTAURANT_FABRICATION_SUSPECTED` | seed語、仮名パターン、根拠情報欠落、異常な住所・座標使い回しを複合評価 | warning / 成功、将来自動公開は隔離 | 不可 | 実在する珍しい店名。AIだけで断定禁止 |
| `RESTAURANT_ID_FORMAT` | ホールと同じkebab-case規則 | error / 失敗 | 正規化候補のみ | ID変更は参照・overrideへ波及 |

`area_id` は現行schemaでは任意で、生成マッチングは同じ都道府県の全飲食店を距離で絞る。area不一致だけで掲載を拒否してはならない。`area_id` が指定されている場合の実在参照はerrorとして監査する。

実在性、正式店名、正確な住所、実歩行時間は現行JSONだけでは確定できない。Phase 1は疑いをwarning・隔離候補として出し、Phase 2のprovenance導入後に自動公開ゲートへ昇格する。

## 7. ビルド・生成・サイト監査

### 7.1 現在利用できる順序

1. `node scripts/validate-restaurant-data.mjs`（既存。npm未接続）
2. `npm run generate:halls`
3. `npx tsc --noEmit -p .`
4. `npx tsc --noEmit -p scripts/tsconfig.json`
5. `npm run build`（`prebuild` で再度 `generate:halls` を実行）

### 7.2 Sprint 1 完了後のCI順序

1. `npm ci`
2. `npm run audit:data` — 正本とoverridesを読み取り専用監査。critical/errorで停止
3. `npm run generate:halls`
4. `git diff --exit-code -- lib/halls/_generated` — 正本とコミット済み生成物の不一致で停止
5. `npm run typecheck` — ルート `tsconfig.json`
6. `npm run typecheck:scripts` — `scripts/tsconfig.json`
7. `npm run test:audit` — 正常・異常フィクスチャ
8. `npm run build` — prebuild再生成を含む冪等性確認
9. `npm run audit:site` — sitemap、内部リンク、JSON-LD、URL件数
10. JSONレポートを成功・失敗にかかわらずartifact保存

### 7.3 各ゲートの失敗条件

| ゲート | 失敗条件 |
| --- | --- |
| データ監査 | criticalまたはerrorが1件以上、レポート生成不能 |
| 自動生成 | JSON/Zod/参照違反、例外、生成不能 |
| 生成差分 | `generate:halls` 後に `_generated` に未コミット差分 |
| アプリ型チェック | `npx tsc --noEmit -p .` 非0 |
| スクリプト型チェック | `npx tsc --noEmit -p scripts/tsconfig.json` 非0 |
| Next.js build | 非0。Google Fonts等の外部取得失敗も公開停止。ただしデータ監査失敗と区別して記録 |
| sitemap | URL構文不正、重複、SITE_URL外、存在しないID、飲食店0件ホールの混入、必須URL欠落 |
| 内部リンク | 静的に列挙できる内部hrefが既知route集合にない。動的・検索routeは許可リスト化 |
| JSON-LD | JSON構文不正、`@context` / `@type` / 必須URL欠落、SITE_URL外 |
| URL件数 | 承認済みbaselineとの差分が予定変更量を超える。baseline未作成の間はinfoとし、推測閾値でCIを落とさない |

現buildは型検証をスキップする設定なので、build成功を型チェック成功の代わりにしてはならない。

## 8. 監査結果JSON形式

### 8.1 例

```json
{
  "schemaVersion": "1.0.0",
  "status": "passed_with_warnings",
  "publishable": true,
  "checkedAt": "2026-07-12T00:00:00.000Z",
  "duration": 1234,
  "summary": {
    "checkedEntities": 567,
    "checkedRules": 32,
    "critical": 0,
    "error": 0,
    "warning": 2,
    "info": 1
  },
  "criticalErrors": 0,
  "errors": 0,
  "warnings": 2,
  "info": 1,
  "issues": [
    {
      "code": "RESTAURANT_COORD_DUPLICATE",
      "severity": "warning",
      "entityType": "restaurant",
      "entityId": "example-restaurant",
      "file": "data/prefectures/tokyo/restaurants.json",
      "message": "異なる店舗が同一の丸め座標を共有しています",
      "details": {
        "coordinate": "35.0000,139.0000",
        "relatedEntityIds": ["example-restaurant-2"]
      },
      "autoFixable": false
    }
  ],
  "checkedFiles": [
    {
      "file": "data/prefectures/tokyo/restaurants.json",
      "sha256": "<64 lowercase hex>",
      "entities": 367
    }
  ]
}
```

### 8.2 フィールド規約

- `schemaVersion`: JSONレポート契約のSemVer。破壊的変更でmajorを上げる。
- `status`: `passed` / `passed_with_warnings` / `failed`。
- `publishable`: critical/errorが0かつ全必須ゲート成功時だけtrue。Phase 1では実際の公開操作は行わない。
- `checkedAt`: UTC ISO 8601。
- `duration`: ミリ秒の非負整数。
- `summary`: 件数集計。トップレベルの重要度件数と一致必須。
- `criticalErrors`, `errors`, `warnings`, `info`: 非負整数。
- `issues`: 安定順（severity、code、file、entityId）でソートする。
- `checkedFiles`: リポジトリ相対POSIXパス、SHA-256、読んだentity件数。生成物も検査した場合は含める。

`details` はJSON objectとし、秘密情報・巨大な原文・絶対ローカルパスを含めない。該当entityがない全体障害は `entityType: "system"`、`entityId: null` を許可する。

### 8.3 整合性規約

- `criticalErrors === summary.critical`
- `errors === summary.error`
- `warnings === summary.warning`
- `info === summary.info`
- 各件数は `issues` のseverity集計と一致
- critical/errorが1件でもあれば `status=failed`, `publishable=false`
- warningだけなら `status=passed_with_warnings`
- issueがなくてもinfoがある場合、statusは `passed`

## 9. AdSense審査中の作業制限

### 実施可能

- `docs/` の追加・修正
- 読み取り専用の監査スクリプト
- 正常・異常フィクスチャとテスト
- GitHub Actionsによる非公開の品質ゲート
- 構造化ログとCI artifact
- 本番表示・公開URL・既存データを変えない内部改善

### 禁止

- 大量のホール・飲食店追加
- 薄いページの量産
- 広告配置、AdSense設定の変更
- 収益最適化
- 大規模UI変更
- 自動公開、自動マージの有効化
- Vercel Proへの変更
- 外部有料サービス契約
- Google Places API、OpenAI APIの導入

Phase 1 のCIは検査だけを行い、PRの自動修正・自動マージ・本番デプロイを起動しない。

## 10. Codex向け Sprint 1 実装計画

Sprint 1 は外部API・AI APIを使わず、既存正本の読み取り専用監査とCI統合までとする。タスクは依存順に実施する。

### S1-01 監査契約・設定・ローダー

- 目的: 重要度、issue、report、対象ファイル、ID索引を共通化する。
- 変更対象候補: `scripts/audit/types.ts`, `scripts/audit/config.ts`, `scripts/audit/load-data.ts`, `scripts/audit/report.ts`
- 実装: 既存 `FileDataSource` / Zod schemaを再利用し、全都道府県、masters、overridesを一度だけロード。安定ソート、SHA-256、終了コードを実装。
- テスト: 正常最小データ、壊れたJSON、schema違反、空ディレクトリ、レポート件数整合。
- 完了条件: 同一fixtureで時刻・duration以外のJSONが一致し、入力を変更しない。
- 依存: なし。
- リスク: 既存 `FileDataSource` が例外で停止し、部分レポートを作れない。
- 誤検知: なし。ローダー失敗はsystem critical。
- Codex注意: `scripts/lib/schema.ts` を複製せず再利用する。`data` と `_generated` を編集しない。

### S1-02 ID・必須項目・参照整合性監査

- 目的: URL衝突、欠損、master/override参照切れを決定論的に防ぐ。
- 変更対象候補: `scripts/audit/check-identity.ts`, `scripts/audit/check-references.ts`
- 実装: ホール/飲食店ID、legacy_idスコープ、area/chain、walk/AI/exclusion overrideの双方向参照、slugを検査。
- テスト: 重複、未知参照、独立ホール、県間legacy重複、任意area_id。
- 完了条件: 本書の該当codeとseverityでJSON issueが出る。
- 依存: S1-01。
- リスク: legacy_idを誤って全世界一意と扱うと現行データが不必要に失敗する。
- 誤検知: 独立ホールのchain_id欠如、飲食店area_id欠如は正常。
- Codex注意: 現生成処理が黙って無視する未使用overrideも検出する。

### S1-03 ホール監査

- 目的: ホールの名称、住所、座標、参照、説明文を監査する。
- 変更対象候補: `scripts/audit/check-halls.ts`
- 実装: 第5章のルール。都道府県bounding boxは設定分離し、境界判定はwarningから開始。
- テスト: 座標入替、国外座標、重複座標、完全重複文、類似文、Maps URL退行。
- 完了条件: 正常fixtureはerror 0、各異常fixtureは指定codeを1件以上返す。
- 依存: S1-01、S1-02。
- リスク: 正式名称・都道府県境界を現行データだけで断定できない。
- 誤検知: 同一建物の別館、英字・記号を含む正式名。
- Codex注意: 公式性はwarningに留め、AIで補完しない。

### S1-04 飲食店監査

- 目的: 飲食店の形式、重複、カテゴリ、住所、説明文、架空疑いを監査する。
- 変更対象候補: `scripts/audit/check-restaurants.ts`
- 実装: 第6章の非距離ルール。8カテゴリは既存schemaから一元取得できないため、二重管理を増やさない設計を優先。
- テスト: ID/legacy重複、invalid genre、重複名+住所、紹介文一致、seed疑い。
- 完了条件: ルールごとのseverity・CI判定が仕様と一致。
- 依存: S1-01、S1-02。
- リスク: 架空判定を断定扱いすると実在店を削除し得る。
- 誤検知: 同名支店、定型紹介文、珍しい店名。
- Codex注意: 自動削除・統合は禁止。

### S1-05 座標・距離・Maps監査

- 目的: 既存生成ロジックと監査ロジックのずれ、10分圏外混入、URL退行を防ぐ。
- 変更対象候補: `scripts/audit/check-geo.ts`, `scripts/audit/check-maps.ts`
- 実装: `scripts/lib/distance.ts`, `scripts/lib/restaurant-matcher.ts`, `lib/maps.ts` を再利用し、定数を複製しない。生成関連と再計算結果を比較。
- テスト: 800m/10分境界、override、exclusion、座標入替、name+address、徒歩mode。
- 完了条件: 境界値テストが通り、現行データは既知warningを除きerror 0。
- 依存: S1-01〜04。
- リスク: 直線距離と実歩行距離の差。
- 誤検知: 駅改札、河川、立体交差、施設内移動。
- Codex注意: 実歩行距離とは表現せず「推定」とする。

### S1-06 JSONレポート・CLI

- 目的: CIが機械判定できる単一コマンドを提供する。
- 変更対象候補: `scripts/audit-data.ts`, `artifacts/automation/` のgitignore方針
- 実装: 第8章形式、stdout要約、`--output`、終了コード0/1/2、原子的出力。
- テスト: warningのみ、error、critical、書込失敗、安定順序、件数整合。
- 完了条件: 成功・失敗時とも可能な限り妥当なJSONを残す。
- 依存: S1-01〜05。
- リスク: レポートパスをGit追跡領域に置き毎回差分を作る。
- 誤検知: なし。
- Codex注意: 絶対パスや環境秘密を出力しない。

### S1-07 正常・異常フィクスチャとテストランナー

- 目的: 監査ルール自身の退行を防ぐ。
- 変更対象候補: `scripts/audit/__fixtures__/`, `scripts/audit/audit.test.ts`, `scripts/audit/run-tests.ts`
- 実装: Node標準 `assert` と既存 `tsx` で最小テストランナーを構成し、新規パッケージを追加しない。
- テスト: 各errorルール最低1件、代表warning、JSONスナップショット、入力非変更。
- 完了条件: 正常fixtureは0、error fixtureは1、critical fixtureは2。
- 依存: S1-06。
- リスク: 本番データを期待値にするとデータ改善でテストが壊れる。
- 誤検知: fixtureは最小・自己完結にする。
- Codex注意: fixtureを `data/` に置かない。

### S1-08 npm scripts・生成・型チェック・build統合

- 目的: ローカルとCIで同じ品質ゲートを実行する。
- 変更対象候補: `package.json`
- 実装候補: `audit:data`, `test:audit`, `typecheck`, `typecheck:scripts`, `audit:site`, `verify`。既存 `build` / `prebuild` の意味を壊さない。
- テスト: Windowsでは `.cmd` 経由、CIでは通常npmで全コマンド実行。
- 完了条件: `verify` が順序どおり停止し、warningだけでは継続する。
- 依存: S1-06、S1-07。
- リスク: buildがGoogle Fontsのネットワークに依存、buildは型エラーを無視。
- 誤検知: 一時ネットワーク障害はデータerrorに混ぜない。
- Codex注意: `npx tsc -p .` と `npx tsc -p scripts/tsconfig.json` の両方を明示実行。

### S1-09 sitemap・内部リンク・JSON-LD・URL件数監査

- 目的: データ監査通過後のサイト構造退行を検出する。
- 変更対象候補: `scripts/audit-site.ts`, URL baseline設定ファイル候補
- 実装: `app/sitemap.ts` とroute生成関数を決定論的に検査し、build成果のリンク・JSON-LDを検証。初回は件数baselineを記録するだけにする。
- テスト: URL重複、外部host混入、存在しないhall、壊れたJSON-LD、予定外件数差。
- 完了条件: 現行route集合で成功し、異常fixtureで失敗する。
- 依存: S1-08。
- リスク: Next.js内部成果物へ過度に依存する。
- 誤検知: 動的 `/search`、クエリ、アンカー、末尾スラッシュ。
- Codex注意: baselineと閾値を推測で固定しない。初回測定値をレビュー可能な設定として保存。

### S1-10 GitHub Actions

- 目的: PRとmainで同じ監査を自動実行する。
- 変更対象候補: `.github/workflows/data-audit.yml`
- 実装: Node/npmを固定、`npm ci`、`verify`、レポートartifact 30日、最小権限 `contents: read`、concurrency cancel-in-progress。
- テスト: 正常ブランチ成功、異常fixture用一時変更で失敗、artifact確認。
- 完了条件: critical/errorで必須check失敗、warningで成功。デプロイ・commit・自動マージを行わない。
- 依存: S1-08、S1-09。
- リスク: 無料枠消費、Google Fontsネットワーク、長時間化。
- 誤検知: 外部ネットワーク障害。
- Codex注意: pull_request_targetを使わず、秘密情報を付与しない。

## 11. Phase 1 完了条件

以下をすべて機械判定できること。

- [ ] 正常な最小fixtureで監査が完走し、終了コード0になる
- [ ] 現行正本で監査が完走し、JSONレポートを生成する
- [ ] 各critical/error異常fixtureを指定codeで検出する
- [ ] criticalまたはerrorが1件以上ならCIが失敗する
- [ ] warningだけなら `passed_with_warnings`、終了コード0になる
- [ ] JSONレポートの件数、status、publishableが相互に整合する
- [ ] 同じ入力を再監査した結果が、時刻・duration以外で一致する
- [ ] 監査処理が `data/`、`lib/halls/_generated/`、アプリコードを変更しない
- [ ] `npm run generate:halls` が成功する
- [ ] 再生成後、`lib/halls/_generated/` に未コミット差分がない
- [ ] アプリ用TypeScript型チェックが成功する
- [ ] scripts用TypeScript型チェックが成功する
- [ ] Next.js buildが成功する
- [ ] sitemap、内部リンク、JSON-LD監査が成功する
- [ ] URL件数baselineが明示的に記録され、未承認の異常増減を検出できる
- [ ] GitHub Actionsが読み取り最小権限で実行される
- [ ] CIがcommit、push、merge、deployを行わない
- [ ] 本番表示と既存正本データに意図しない差分がない

## 12. 未確定事項

次はリポジトリから確定できないため、推測で仕様値を埋めない。

1. 本番・CIで保証するNode.jsの正式バージョン。依頼想定はv22、調査環境はv24、`engines`未指定。
2. 「期待値飯」から除外する大規模チェーンの正式リストと判定単位。
3. 店舗実在性・正式名称・住所・座標の検証元、必要根拠数、有効期限。
4. 都道府県境界判定に使う正式polygon/bounding box。
5. 紹介文「過度な類似」の閾値。現行正常データで分布を測ってから確定する。
6. sitemap・総URL件数の承認済みbaselineと、変更予定量の受け渡し方法。
7. Phase 3以降の日次・月次費用上限額。
8. 重大例外の通知先と、夜間・休日を含む通知方針。
9. 隔離候補の保存場所。Phase 2までは正本に状態フィールドを追加しない。
10. 自動公開・自動マージを将来許可するか。現時点では禁止。

未確定事項が解消するまでは fail closed とし、該当する自動取得・自動公開を開始しない。ただし Phase 1 の読み取り専用監査は、未確定項目を `info` または明記した `warning` として継続できる。

## 13. Sprint 1 の先頭タスク

最初に実装するのは **S1-01 監査契約・設定・ローダー** とする。

既存の `scripts/lib/schema.ts` と `scripts/sources/file-source.ts` を再利用し、データを一切変更せず、全対象ファイル・入力ハッシュ・共通issue型・終了コード・安定したJSONレポート骨格を先に確立する。個別ルールを先に書くと、重要度、ファイルパス、集計、CI判定が各スクリプトで分裂するため、S1-01完了前にホール・飲食店ルールへ進まない。
