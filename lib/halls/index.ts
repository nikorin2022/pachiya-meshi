/**
 * パチ屋飯 - ホールデータ アクセスファサード
 *
 * Phase B 以降、ホール / 飲食店データは `data/` 配下の JSON を
 * `scripts/generate-prefecture-data.ts` で TypeScript に変換した
 * `lib/halls/_generated/` を**唯一の真正データソース**として扱う。
 *
 * データ追加・修正の流れ:
 *   1. data/prefectures/<pref>/halls.json / restaurants.json を編集
 *   2. 必要に応じて data/overrides/*.json を編集
 *   3. `npm run generate:halls` で再生成
 *      （または `npm run build` の prebuild フックで自動再生成）
 *   4. `npm run diff:halls` で legacy ダンプとの差分を確認 (任意)
 *
 * 注意:
 *   - `lib/halls/island-akihabara.ts` / `lib/halls/espace-akihabara-ekimae.ts`
 *     は Phase A 完了まで残置するが、ここからは参照しない（ロールバック手段）。
 *   - `lib/halls/_generated/` は手動編集禁止。
 */

export { getAllHalls, getHallById, getAllHallIds } from "./_generated"
