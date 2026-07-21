import { AUDIT_RULE_CODES, AUDIT_RULE_COUNT } from "../audit-runner"
import { GEO_RULE_CODES, GEO_RULE_COUNT } from "../check-geo"
import { HALL_RULE_CODES, HALL_RULE_COUNT } from "../check-halls"
import { IDENTITY_RULE_CODES, IDENTITY_RULE_COUNT } from "../check-identity"
import { REFERENCE_RULE_CODES, REFERENCE_RULE_COUNT } from "../check-references"
import { RESTAURANT_RULE_CODES, RESTAURANT_RULE_COUNT } from "../check-restaurants"
import { assert, test } from "./test-harness"

export type RuleCoverageCase = { readonly code: string; readonly testName: string }

const groups = [
  ["identity fixtures", IDENTITY_RULE_CODES],
  ["reference fixtures", REFERENCE_RULE_CODES],
  ["hall fixtures", HALL_RULE_CODES],
  ["restaurant fixtures", RESTAURANT_RULE_CODES],
  ["geo and maps fixtures", GEO_RULE_CODES],
] as const

/** すべての通常ルールを、該当fixtureテスト群へ明示的に関連付ける。 */
export const RULE_COVERAGE: readonly RuleCoverageCase[] = groups.flatMap(([testName, codes]) =>
  codes.map((code) => ({ code, testName })),
)

test("rule registry and coverage manifest contain exactly 50 normal codes", () => {
  assert.equal(IDENTITY_RULE_COUNT, IDENTITY_RULE_CODES.length)
  assert.equal(REFERENCE_RULE_COUNT, REFERENCE_RULE_CODES.length)
  assert.equal(HALL_RULE_COUNT, HALL_RULE_CODES.length)
  assert.equal(RESTAURANT_RULE_COUNT, RESTAURANT_RULE_CODES.length)
  assert.equal(GEO_RULE_COUNT, GEO_RULE_CODES.length)
  assert.equal(AUDIT_RULE_COUNT, 50)
  assert.equal(AUDIT_RULE_CODES.length, 50)
  assert.equal(new Set(AUDIT_RULE_CODES).size, 50)
  assert.deepEqual(new Set(RULE_COVERAGE.map(({ code }) => code)), new Set(AUDIT_RULE_CODES))
  assert.equal(RULE_COVERAGE.some(({ code }) => code.startsWith("AUDIT_SYSTEM_")), false)
})
