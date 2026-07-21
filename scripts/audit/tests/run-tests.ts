import "./rule-coverage.test"
import "./runtime-coverage.test"
import "./audit-runner.test"
import "./cli.test"
import "./write-report.test"
import { runRegisteredTests } from "./test-harness"

void runRegisteredTests().then(({ passed, failed }) => {
  process.stdout.write(`RESULT passed=${passed} failed=${failed}\n`)
  process.exitCode = failed === 0 ? 0 : 1
}).catch(() => {
  process.stderr.write("FAIL test runner setup failed\n")
  process.exitCode = 1
})
