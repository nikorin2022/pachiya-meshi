import { checkGeo } from "../check-geo"
import { checkHalls } from "../check-halls"
import { checkIdentity } from "../check-identity"
import { checkMaps } from "../check-maps"
import { checkReferences } from "../check-references"
import { checkRestaurants } from "../check-restaurants"
import { AUDIT_RULE_CODES } from "../audit-runner"
import type { AuditData } from "../types"
import { AiSummaryOverrideSchema, AreaSchema, ChainSchema, ExclusionOverrideSchema, HallSchema, RestaurantSchema, WalkMinutesOverrideSchema } from "../../lib/schema"
import { assert, test } from "./test-harness"
import { generatedHalls, readJson, withFixture } from "./fixture-utils"

type RecordValue = Record<string, unknown>

test("every normal rule code is emitted by its real checker", async () => {
  await withFixture(async (root) => {
    const areas = await readJson<RecordValue[]>(root, "data/areas.json")
    const chains = await readJson<RecordValue[]>(root, "data/chains.json")
    const halls = await readJson<RecordValue[]>(root, "data/prefectures/tokyo/halls.json")
    const restaurants = await readJson<RecordValue[]>(root, "data/prefectures/tokyo/restaurants.json")
    const baseHall = halls[0]!
    const baseRestaurant = restaurants[0]!
    const text = (length: number, suffix = "") => `${"説明文".repeat(Math.ceil(length / 3)).slice(0, length - suffix.length)}${suffix}`
    const hall = (id: string, extra: RecordValue = {}) => ({ ...baseHall, id, name: `ホール ${id}`, address: "東京都千代田区1-1", pachiya_comment: text(100), meal_guide: text(200), lat: 35.6812, lng: 139.7671, ...extra })
    const restaurant = (id: string, extra: RecordValue = {}) => ({ ...baseRestaurant, id, name: `飲食店 ${id}`, address: "東京都千代田区1-1", default_ai_summary: text(120), lat: 35.6813, lng: 139.7672, ...extra })

    const validData = makeData({
      areas: [{ ...areas[0], id: "area-one", name: "area one", area_description: text(200) }],
      chains: [{ ...chains[0], id: "chain-one", name: "chain one", description: text(100) }],
      halls: [
        hall("hall-duplicate", { name: "仮称", area_id: "missing-area", chain_id: "missing-chain", address: "https://example.invalid", pachiya_comment: " ".repeat(80), meal_guide: " ".repeat(180), lat: 35.681, lng: 139.767 }),
        hall("hall-duplicate", { name: "同名ホール", lat: 35.6001, lng: 139.6001, address: "東京都千代田区2-2" }),
        hall("hall-name-two", { name: "同名ホール", lat: 35.6001, lng: 139.6001, address: "東京都千代田区3-3", pachiya_comment: text(100, "A"), meal_guide: text(200, "A") }),
        hall("hall-map", { name: "35.1, 139.1", address: " ", lat: 35.6002, lng: 139.6002, pachiya_comment: text(100, "B"), meal_guide: "abcdefghij".repeat(20) }),
        hall("hall-outside", { lat: 35.0, lng: 130.0, pachiya_comment: text(200, "C"), meal_guide: text(200, "C") }),
        hall("hall-similar", { lat: 35.1, lng: 130.1, pachiya_comment: text(100, "D"), meal_guide: "abcdefghij".repeat(21) }),
      ],
      restaurants: [
        restaurant("restaurant-duplicate", { name: "同名飲食店", address: "https://example.invalid", area_id: "missing-area", default_ai_summary: text(120, "X"), lat: 35.6001, lng: 139.6001, selection_note: "seed" }),
        restaurant("restaurant-duplicate", { name: "同名飲食店", address: "東京都千代田区2-2", default_ai_summary: text(120, "X"), lat: 35.6001, lng: 139.6001 }),
        restaurant("restaurant-summary-three", { name: "同名飲食店", address: "東京都千代田区3-3", default_ai_summary: text(120, "X"), lat: 35.6001, lng: 139.6001 }),
        restaurant("restaurant-map", { name: "35.1, 139.1", address: " ", default_ai_summary: "abcdefghij".repeat(12), lat: 35.6002, lng: 139.6002 }),
        restaurant("restaurant-outside", { address: "東京都千代田区4-4", lat: 35.0, lng: 130.0, default_ai_summary: "abcdefghij".repeat(13) }),
        restaurant("restaurant-required", { hours: " " }),
      ],
      walkMinutesOverrides: [
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", walkMinutes: 1 },
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", walkMinutes: 2 },
      ],
      aiSummaryOverrides: [
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", ai_summary: "seed" },
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", ai_summary: "seed" },
      ],
      exclusions: [
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", reason: "test" },
        { hall_id: "missing-hall", restaurant_id: "missing-restaurant", reason: "test" },
      ],
    })
    const identityData = makeData({
      areas: [{ ...areas[0], id: "area-duplicate", name: " ", area_description: " ".repeat(200) }, { ...areas[0], id: "area-duplicate", name: "area two", area_description: text(200) }],
      chains: [{ ...chains[0], id: "chain-duplicate", name: " ", description: " ".repeat(100) }, { ...chains[0], id: "chain-duplicate", name: "chain two", description: text(100) }],
      halls: validData.halls as unknown as RecordValue[], restaurants: validData.restaurants as unknown as RecordValue[], walkMinutesOverrides: [], aiSummaryOverrides: [], exclusions: [],
    })
    assertSchemaValid(validData)
    assertSchemaValid(identityData)
    const generated = await generatedHalls(root)
    const invalidGenerated = generated.map((item) => ({ ...item, restaurants: item.restaurants.map((entry) => ({ ...entry, walkMinutes: 99 })) }))
    const actual = [
      ...checkIdentity(identityData), ...checkReferences(validData), ...checkHalls(validData),
      ...checkRestaurants(validData), ...checkGeo(validData, invalidGenerated), ...checkMaps(validData, invalidGenerated),
    ]

    const unsafe = makeData({
      areas: [{ ...areas[0], id: "INVALID" }], chains: [{ ...chains[0], id: "INVALID" }],
      halls: [
        hall("INVALID", { lat: null, lng: null, pachiya_comment: text(100, "A"), meal_guide: text(200, "A") }),
        hall("hall-swapped", { lat: 139, lng: 35, pachiya_comment: text(100, "B"), meal_guide: text(200, "B") }),
        hall("hall-format", { lat: Number.NaN, lng: 139, pachiya_comment: text(100, "C"), meal_guide: text(200, "C") }),
      ],
      restaurants: [
        restaurant("INVALID", { name: "B restaurant one", legacy_id: 1000, genre: "invalid", lat: null, lng: null, time_category: [], default_ai_summary: text(120, "B1") }),
        restaurant("restaurant-format", { name: "B restaurant two", legacy_id: 1001, lat: Number.NaN, lng: 139, default_ai_summary: text(120, "B2") }),
      ],
      walkMinutesOverrides: [], aiSummaryOverrides: [], exclusions: [],
    })
    const aCodes = new Set(actual.map((issue) => issue.code))
    const bCodes = new Set([
      ...checkIdentity(unsafe).map((issue) => issue.code),
      ...checkHalls(unsafe).map((issue) => issue.code),
      ...checkRestaurants(unsafe).map((issue) => issue.code),
      ...checkGeo(makeData({ areas: unsafe.areas as unknown as RecordValue[], chains: unsafe.chains as unknown as RecordValue[], halls: [], restaurants: unsafe.restaurants as unknown as RecordValue[], walkMinutesOverrides: [], aiSummaryOverrides: [], exclusions: [] }), []).map((issue) => issue.code),
    ])
    const bOnly = [
      "AREA_ID_FORMAT", "CHAIN_ID_FORMAT", "HALL_ID_FORMAT", "RESTAURANT_ID_FORMAT",
      "HALL_COORD_MISSING", "HALL_COORD_FORMAT", "HALL_COORD_SWAPPED", "RESTAURANT_GENRE_INVALID",
      "RESTAURANT_COORD_MISSING", "RESTAURANT_COORD_FORMAT",
    ]
    const mixed = "RESTAURANT_REQUIRED_MISSING"
    const aOnly = AUDIT_RULE_CODES.filter((code) => code !== mixed && !bOnly.includes(code))
    assert.equal(aOnly.length, 39)
    const expectedACodes = [...aOnly, mixed]
    assert.deepEqual(expectedACodes.filter((code) => !aCodes.has(code)), [])
    assert.deepEqual([...aCodes].filter((code) => !expectedACodes.includes(code)), [])
    assert.deepEqual([...bCodes].sort(), [...bOnly, mixed].sort())
    assert.deepEqual([...new Set([...aCodes, ...bCodes])].sort(), [...AUDIT_RULE_CODES].sort())
  })
})

function makeData(input: Record<string, readonly RecordValue[]>): AuditData {
  const areas = input.areas ?? []
  const chains = input.chains ?? []
  const halls = input.halls ?? []
  const restaurants = input.restaurants ?? []
  const firstById = (values: readonly RecordValue[]) => new Map(values.map((value) => [String(value.id), value]))
  return {
    repositoryRoot: "fixture", prefectures: ["tokyo"], areas: areas as never, chains: chains as never,
    halls: halls as never, restaurants: restaurants as never,
    hallsByPrefecture: new Map([["tokyo", halls as never]]), restaurantsByPrefecture: new Map([["tokyo", restaurants as never]]),
    walkMinutesOverrides: (input.walkMinutesOverrides ?? []) as never, aiSummaryOverrides: (input.aiSummaryOverrides ?? []) as never, exclusions: (input.exclusions ?? []) as never,
    indexes: { areaById: firstById(areas) as never, chainById: firstById(chains) as never, hallById: firstById(halls) as never, restaurantById: firstById(restaurants) as never, hallsByPrefecture: new Map([["tokyo", halls as never]]), restaurantsByPrefecture: new Map([["tokyo", restaurants as never]]) },
    checkedFiles: [], inputHash: "fixture", checkedEntities: areas.length + chains.length + halls.length + restaurants.length,
  }
}

function assertSchemaValid(data: AuditData): void {
  for (const value of data.areas) assert.equal(AreaSchema.safeParse(value).success, true)
  for (const value of data.chains) assert.equal(ChainSchema.safeParse(value).success, true)
  for (const value of data.halls) assert.equal(HallSchema.safeParse(value).success, true)
  for (const value of data.restaurants) assert.equal(RestaurantSchema.safeParse(value).success, true)
  for (const value of data.walkMinutesOverrides) assert.equal(WalkMinutesOverrideSchema.safeParse(value).success, true)
  for (const value of data.aiSummaryOverrides) assert.equal(AiSummaryOverrideSchema.safeParse(value).success, true)
  for (const value of data.exclusions) assert.equal(ExclusionOverrideSchema.safeParse(value).success, true)
}
