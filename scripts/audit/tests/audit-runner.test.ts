import fs from "node:fs/promises"
import path from "node:path"
import { createGeneratedSnapshotHash, runAudit } from "../audit-runner"
import { assert, test } from "./test-harness"
import { assertNoUnsafeDiagnosticStrings, fixedRunOptions, generatedHalls, readJson, withFixture, writeJson } from "./fixture-utils"

const hallsFile = "data/prefectures/tokyo/halls.json"
const restaurantsFile = "data/prefectures/tokyo/restaurants.json"

test("minimal valid fixture passes with a stable complete report", async () => {
  await withFixture(async (root) => {
    const generated = await generatedHalls(root)
    const first = await runAudit(fixedRunOptions(root, generated))
    const second = await runAudit(fixedRunOptions(root, generated))
    assert.equal(first.exitCode, 0)
    assert.equal(first.report.status, "passed")
    assert.equal(first.report.publishable, true)
    assert.deepEqual(first.report.summary, { checkedEntities: 4, checkedRules: 50, critical: 0, error: 0, warning: 0, info: 0 })
    assert.equal(first.report.issues.length, 0)
    assert.match(first.report.inputHash, /^[a-f0-9]{64}$/u)
    assert.deepEqual(first.report, second.report)
  })
})

test("generated snapshot is canonically hashed into inputHash", async () => {
  await withFixture(async (root) => {
    const generated = await generatedHalls(root)
    const first = await runAudit(fixedRunOptions(root, generated))
    const same = await runAudit(fixedRunOptions(root, generated.map((hall) => ({ ...hall, restaurants: hall.restaurants.map((restaurant) => ({ ...restaurant })) }))))
    assert.equal(first.report.inputHash, same.report.inputHash)

    const additionalHall = { ...generated[0], id: "second-generated-hall" }
    const reorderedHalls = [additionalHall, generated[0]]
    const reversedHalls = [...reorderedHalls].reverse()
    assert.notEqual(createGeneratedSnapshotHash(reorderedHalls), createGeneratedSnapshotHash(reversedHalls))
    assert.notEqual(
      (await runAudit(fixedRunOptions(root, reorderedHalls))).report.inputHash,
      (await runAudit(fixedRunOptions(root, reversedHalls))).report.inputHash,
    )

    const firstRestaurant = generated[0]?.restaurants[0]
    assert.ok(firstRestaurant)
    const hallWithTwoRestaurants = [{
      ...generated[0],
      restaurants: [firstRestaurant, { ...firstRestaurant, id: firstRestaurant.id + 1000 }],
    }]
    assert.notEqual(
      createGeneratedSnapshotHash(hallWithTwoRestaurants),
      createGeneratedSnapshotHash([{ ...hallWithTwoRestaurants[0], restaurants: [...hallWithTwoRestaurants[0].restaurants].reverse() }]),
    )
    const generatedRestaurantOrderChanged = await runAudit(fixedRunOptions(root, hallWithTwoRestaurants))
    const generatedRestaurantOrderReversed = await runAudit(fixedRunOptions(root, [{
      ...hallWithTwoRestaurants[0], restaurants: [...hallWithTwoRestaurants[0].restaurants].reverse(),
    }]))
    assert.deepEqual(generatedRestaurantOrderChanged.report.checkedFiles, generatedRestaurantOrderReversed.report.checkedFiles)
    assert.notEqual(generatedRestaurantOrderChanged.report.inputHash, generatedRestaurantOrderReversed.report.inputHash)

    const changedSnapshot = [{
      ...generated[0],
      restaurants: generated[0].restaurants.map((restaurant) => ({ ...restaurant, walkMinutes: restaurant.walkMinutes + 1 })),
    }]
    const changed = await runAudit(fixedRunOptions(root, changedSnapshot))
    assert.notEqual(first.report.inputHash, changed.report.inputHash)
    assert.ok(changed.report.issues.some((issue) => issue.code === "RESTAURANT_DISTANCE_ABNORMAL"))

    const halls = await readJson<Array<Record<string, unknown>>>(root, hallsFile)
    halls[0].address = "https://input-change.example/hall"
    await writeJson(root, hallsFile, halls)
    const changedSource = await runAudit(fixedRunOptions(root, generated))
    assert.notEqual(first.report.inputHash, changedSource.report.inputHash)
    assert.notEqual(
      first.report.checkedFiles.find((file) => file.file === hallsFile)?.sha256,
      changedSource.report.checkedFiles.find((file) => file.file === hallsFile)?.sha256,
    )
  })
})

test("generated snapshot hash failures become safe generatedSnapshot criticals", async () => {
  await withFixture(async (root) => {
    const result = await runAudit({
      repositoryRoot: root,
      generatedHalls: [{ unsupported: 1n }] as unknown as readonly import("../../../lib/halls/types").PachinkoHall[],
      checkedAt: "2026-07-13T00:00:00.000Z",
      now: () => 1,
    })
    assert.equal(result.exitCode, 2)
    assert.equal(result.report.issues[0]?.code, "AUDIT_SYSTEM_EXECUTION_FAILURE")
    assert.deepEqual(result.report.issues[0]?.details, { kind: "execution_failure", stage: "generatedSnapshot" })
    assertNoUnsafeDiagnosticStrings(result.report, root, ["unsupported"])
  })
})

test("low precision hall coordinate is warning-only", async () => {
  await withFixture(async (root) => {
    const halls = await readJson<Array<Record<string, unknown>>>(root, hallsFile)
    halls[0].lat = 35.681
    await writeJson(root, hallsFile, halls)
    const result = await runAudit(fixedRunOptions(root, await generatedHalls(root)))
    assert.equal(result.exitCode, 0)
    assert.equal(result.report.status, "passed_with_warnings")
    assert.equal(result.report.publishable, true)
    assert.equal(result.report.summary.error, 0)
    assert.ok(result.report.issues.some((issue) => issue.code === "HALL_COORD_LOW_PRECISION"))
  })
})

test("valid JSON with a normal rule error fails with exit code 1", async () => {
  await withFixture(async (root) => {
    const restaurants = await readJson<Array<Record<string, unknown>>>(root, restaurantsFile)
    restaurants[0].address = "https://invalid.example/restaurant"
    await writeJson(root, restaurantsFile, restaurants)
    const result = await runAudit(fixedRunOptions(root, await generatedHalls(root)))
    assert.equal(result.exitCode, 1)
    assert.equal(result.report.status, "failed")
    assert.equal(result.report.publishable, false)
    assert.equal(result.report.summary.critical, 0)
    assert.ok(result.report.issues.some((issue) => issue.code === "RESTAURANT_ADDRESS_MISSING" && issue.severity === "error"))
  })
})

test("invalid JSON produces a safe load critical", async () => {
  await withFixture(async (root) => {
    await fs.writeFile(path.join(root, "data", "areas.json"), "{ invalid", "utf8")
    const result = await runAudit({ repositoryRoot: root, checkedAt: "2026-07-13T00:00:00.000Z", now: () => 1 })
    assert.equal(result.exitCode, 2)
    assert.equal(result.report.summary.critical, 1)
    assert.equal(result.report.issues[0]?.code, "AUDIT_SYSTEM_LOAD_FAILURE")
    assert.equal(result.report.issues[0]?.file, "data/areas.json")
    assertNoUnsafeDiagnosticStrings(result.report, root, ["invalid"])
    assert.match(result.report.inputHash, /^[a-f0-9]{64}$/u)
    const repeat = await runAudit({ repositoryRoot: root, checkedAt: "2026-07-13T00:00:00.000Z", now: () => 1 })
    assert.equal(repeat.report.inputHash, result.report.inputHash)
  })
})

test("missing required file and schema violation are safe load criticals", async () => {
  await withFixture(async (root) => {
    await fs.rm(path.join(root, ...hallsFile.split("/")))
    const missing = await runAudit({ repositoryRoot: root, now: () => 1 })
    assert.equal(missing.exitCode, 2)
    assert.equal(missing.report.issues[0]?.file, hallsFile)
    assert.equal((missing.report.issues[0]?.details as { readonly kind?: string } | undefined)?.kind, "file_missing")
    assert.equal(missing.report.status, "failed")
    assert.equal(missing.report.publishable, false)
    assert.equal(missing.report.summary.error, 0)
    assertNoUnsafeDiagnosticStrings(missing.report, root)
  })
  await withFixture(async (root) => {
    const restaurants = await readJson<Array<Record<string, unknown>>>(root, restaurantsFile)
    restaurants[0].lat = "not-a-number"
    await writeJson(root, restaurantsFile, restaurants)
    const schema = await runAudit({ repositoryRoot: root, now: () => 1 })
    assert.equal(schema.exitCode, 2)
    assert.equal((schema.report.issues[0]?.details as { readonly kind?: string } | undefined)?.kind, "schema_validation")
    assert.equal(schema.report.status, "failed")
    assert.equal(schema.report.publishable, false)
    assert.equal(schema.report.summary.critical, 1)
    assert.equal(schema.report.summary.error, 0)
    assertNoUnsafeDiagnosticStrings(schema.report, root, ["not-a-number"])
  })
})

test("execution failure preserves loaded input facts and identifies its stage", async () => {
  await withFixture(async (root) => {
    const generated = await generatedHalls(root)
    const normal = await runAudit(fixedRunOptions(root, generated))
    const failed = await runAudit({
      ...fixedRunOptions(root, generated),
      stages: { checkGeo: () => { throw new Error("fixture execution failure") } },
    })
    assert.equal(failed.exitCode, 2)
    assert.equal(failed.report.issues[0]?.code, "AUDIT_SYSTEM_EXECUTION_FAILURE")
    assert.deepEqual(failed.report.issues[0]?.details, { kind: "execution_failure", stage: "checkGeo" })
    assert.equal(failed.report.inputHash, normal.report.inputHash)
    assert.equal(failed.report.summary.checkedEntities, normal.report.summary.checkedEntities)
    assert.deepEqual(failed.report.checkedFiles, normal.report.checkedFiles)
    assertNoUnsafeDiagnosticStrings(failed.report, root, ["fixture execution failure"])
  })
})

test("multi-entity reverse fixture preserves semantic issues while raw hashes and indexes change", async () => {
  await withFixture(async (root) => {
    const halls = await readJson<Array<Record<string, unknown>>>(root, hallsFile)
    const restaurants = await readJson<Array<Record<string, unknown>>>(root, restaurantsFile)
    const areas = await readJson<Array<Record<string, unknown>>>(root, "data/areas.json")
    const chains = await readJson<Array<Record<string, unknown>>>(root, "data/chains.json")
    const hall = halls[0]!
    const restaurant = restaurants[0]!
    await writeJson(root, "data/areas.json", [areas[0], { ...areas[0], id: "tokyo-two", name: "東京二区" }])
    await writeJson(root, "data/chains.json", [chains[0], { ...chains[0], id: "chain-two", name: "チェーン二区" }])
    await writeJson(root, hallsFile, [
      { ...hall, id: "hall-one", name: "同名ホール", lat: 35.681, lng: 139.767 },
      { ...hall, id: "hall-two", name: "同名ホール", address: "東京都千代田区2-2", lat: 35.681, lng: 139.767 },
    ])
    await writeJson(root, restaurantsFile, [
      { ...restaurant, id: "restaurant-one", name: "同名飲食店", address: "https://invalid.example/one" },
      { ...restaurant, id: "restaurant-two", name: "同名飲食店", address: "東京都千代田区2-2" },
      { ...restaurant, id: "restaurant-three", name: "同名飲食店", address: "東京都千代田区3-3" },
      { ...restaurant, id: "restaurant-four", name: "別飲食店", address: "東京都千代田区4-4" },
    ])
    await writeJson(root, "data/overrides/walk-minutes.json", [
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", walkMinutes: 1 },
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", walkMinutes: 2 },
    ])
    await writeJson(root, "data/overrides/ai-summary.json", [
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", ai_summary: "seed" },
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", ai_summary: "seed" },
    ])
    await writeJson(root, "data/overrides/exclusions.json", [
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", reason: "test" },
      { hall_id: "missing-hall", restaurant_id: "missing-restaurant", reason: "test" },
    ])
    const generated = await generatedHalls(root)
    const expandedGenerated = [
      { ...generated[0], id: "hall-one", restaurants: [generated[0]!.restaurants[0]!, { ...generated[0]!.restaurants[0]!, id: 2000 }] },
      { ...generated[0], id: "hall-two", restaurants: [generated[0]!.restaurants[0]!, { ...generated[0]!.restaurants[0]!, id: 2001 }] },
    ]
    const before = await runAudit(fixedRunOptions(root, expandedGenerated))
    for (const relativePath of ["data/areas.json", "data/chains.json", hallsFile, restaurantsFile, "data/overrides/walk-minutes.json", "data/overrides/ai-summary.json", "data/overrides/exclusions.json"]) {
      const value = await readJson<unknown[]>(root, relativePath)
      await writeJson(root, relativePath, [...value].reverse())
    }
    const after = await runAudit(fixedRunOptions(root, expandedGenerated.map((item) => ({ ...item, restaurants: [...item.restaurants].reverse() })).reverse()))
    assert.notEqual(after.report.inputHash, before.report.inputHash)
    assert.notDeepEqual(after.report.checkedFiles.map((file) => file.sha256), before.report.checkedFiles.map((file) => file.sha256))
    const afterSemanticIssues = semanticIssues(after.report.issues)
    const beforeSemanticIssues = semanticIssues(before.report.issues)
    assert.deepEqual(afterSemanticIssues, beforeSemanticIssues)
    assert.deepEqual(after.report.summary, before.report.summary)
    assert.equal(after.report.status, before.report.status)
    assert.equal(after.report.publishable, before.report.publishable)
    assert.equal(after.exitCode, before.exitCode)
    assert.equal(after.report.summary.checkedEntities, before.report.summary.checkedEntities)
    const issueWithHallId = before.report.issues.find((issue) =>
      issue.details && typeof issue.details === "object" && "hallId" in issue.details)
    assert.ok(issueWithHallId)
    const changedDetail = {
      ...issueWithHallId,
      details: { ...(issueWithHallId.details as Record<string, unknown>), hallId: "changed-hall-id" },
    }
    assert.notDeepEqual(semanticIssues([issueWithHallId]), semanticIssues([changedDetail]))
  })
})

function semanticIssues(issues: readonly unknown[]): readonly string[] {
  return issues.map((issue) => JSON.stringify(removeIssueIdAndLocationIndexes(issue))).sort()
}

function removeIssueIdAndLocationIndexes(value: unknown, parentKey: string | null = null): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => removeIssueIdAndLocationIndexes(item, parentKey))
    return ["locations", "candidates", "sourceResolution", "hallIds", "restaurantIds", "prefectures", "addresses", "invalidEndpoints", "signals", "selectionTags", "mismatchedFields"].includes(parentKey ?? "")
      ? normalized.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
      : normalized
  }
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !(parentKey === null && key === "id") && !((parentKey === "location" || parentKey === "locations") && key === "index"))
    .map(([key, child]) => [key, removeIssueIdAndLocationIndexes(child, key)]))
}
