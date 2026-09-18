const { spawnSync } = require("child_process");
const path = require("path");

const jestBin = require.resolve("jest/bin/jest");
const result = spawnSync(
  process.execPath,
  [
    jestBin,
    "--runInBand",
    "--forceExit",
    path.join("__tests__", "lib", "spec-test", "scoring-laboratory.test.ts"),
  ],
  {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, SPEC_TEST_AUDIT_REPORT: "1" },
    stdio: "inherit",
  },
);

process.exitCode = result.status ?? 1;
