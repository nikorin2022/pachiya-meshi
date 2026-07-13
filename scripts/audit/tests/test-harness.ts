import assert from "node:assert/strict"

type TestCase = { readonly name: string; readonly run: () => void | Promise<void> }

const cases: TestCase[] = []

export function test(name: string, run: TestCase["run"]): void {
  cases.push({ name, run })
}

export async function runRegisteredTests(): Promise<{ readonly passed: number; readonly failed: number }> {
  let passed = 0
  let failed = 0
  for (const item of cases) {
    try {
      await item.run()
      passed += 1
      process.stdout.write(`PASS ${item.name}\n`)
    } catch (error) {
      failed += 1
      process.stderr.write(`FAIL ${item.name}: ${safeMessage(error)}\n`)
    }
  }
  return { passed, failed }
}

export { assert }

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unexpected test failure"
  return message.replace(/[A-Za-z]:\\[^\n]*/gu, "<path>").replace(/\/[^\s\n]+/gu, "<path>").slice(0, 300)
}
