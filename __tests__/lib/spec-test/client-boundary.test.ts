import fs from "fs";
import path from "path";

// Acceptance criteria from docs/spec-test-v2-implementation-plan.md §7: "Client bundles
// contain no loadings, centroids or τ." Checked structurally rather than by inspecting a
// built bundle: every file under scoring/ (where those live) must declare `server-only`,
// and every client-safe file (items/taxonomy/response) must neither declare `server-only`
// nor import from scoring/ - so a client component that imports them can never pull the
// scoring internals in transitively.

const ROOT = path.join(process.cwd(), "lib", "spec-test");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(dir, entry.name));
}

describe("spec test v2 client/server boundary", () => {
  it("marks every scoring/ module server-only", () => {
    for (const file of listFiles("scoring")) {
      const source = read(file);
      expect(source).toMatch(/^import\s+"server-only";/);
    }
  });

  it("keeps the client-safe modules free of server-only and scoring imports", () => {
    const clientSafeFiles = ["taxonomy.ts", "response.ts", "items/spec-v2.ts", "items/index.ts"];
    for (const file of clientSafeFiles) {
      const source = read(file);
      expect(source).not.toMatch(/"server-only"/);
      expect(source).not.toMatch(/@\/lib\/spec-test\/scoring/);
    }
  });

  it("never exposes a bracketed motive/facet code in item prompts or labels", () => {
    // The report is explicit (§5) that these must never reach the browser - the item bank
    // itself is what ships to the client, so checking it here doubles as the "no loadings in
    // client bundles" guarantee for this specific leak shape.
    const source = read("items/spec-v2.ts");
    const promptAndLabelLines = source
      .split("\n")
      .filter((line) => /\b(prompt|label):/.test(line))
      .map((line) => line.split("//")[0]); // strip trailing loading-code comments before checking
    for (const line of promptAndLabelLines) {
      expect(line).not.toMatch(/\[[A-Za-z-]+\]/);
    }
  });
});
