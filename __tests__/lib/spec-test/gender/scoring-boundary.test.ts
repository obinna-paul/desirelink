import fs from "fs";
import path from "path";

import { decideSpecTestResult } from "@/lib/spec-test/scoring/decide";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

// Acceptance criteria from docs/spec-test-gender-implementation-plan.md §6 (Phase G1),
// principle 1: "Gender contributes exactly zero to the score, and we prove it mechanically."
//
// The strongest form of that guarantee isn't a runtime comparison of two computed results -
// it's that the scoring/interpretation code has no way to see gender at all. These tests
// check both: the structural guarantee (no gender import anywhere in scoring), and the
// functional one (decideSpecTestResult's declared signature has no room for a gender/form
// argument, and repeated calls with the same input never vary).

const LIB_ROOT = path.join(process.cwd(), "lib", "spec-test");

function listTsFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFilesRecursive(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("scoring/interpretation never import the gender module", () => {
  it("has no import of @/lib/spec-test/gender anywhere under scoring/", () => {
    const files = listTsFilesRecursive(path.join(LIB_ROOT, "scoring"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/spec-test\/gender/);
    }
  });

  it("has no import of @/lib/spec-test/gender anywhere under interpretation/", () => {
    const files = listTsFilesRecursive(path.join(LIB_ROOT, "interpretation"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/spec-test\/gender/);
    }
  });
});

describe("decideSpecTestResult cannot see gender", () => {
  it("declares exactly two parameters - items and responses - with no room for a third", () => {
    expect(decideSpecTestResult.length).toBe(2);
  });

  it("produces an identical decision for identical input, with nothing else able to vary it", () => {
    const responses: SpecTestResponseV2[] = SPEC_TEST_ITEMS_V2.map((item, i) => {
      const suffix = (["a", "b", "c", "d"] as const)[i % 4];
      const index = ["a", "b", "c", "d"].indexOf(suffix);
      return { itemId: item.id, optionId: item.options[index].id, presentedIndex: index, elapsedMs: 2500 + i * 40 };
    });

    const first = decideSpecTestResult(SPEC_TEST_ITEMS_V2, responses);
    const second = decideSpecTestResult(SPEC_TEST_ITEMS_V2, [...responses]);
    expect(first).toEqual(second);
  });
});

describe("item and option ids are gender-invariant by construction", () => {
  it("contains no template token in any item id or option id (only labels/prompts may be templated in G2)", () => {
    for (const item of SPEC_TEST_ITEMS_V2) {
      expect(item.id).not.toMatch(/[{}]/);
      for (const option of item.options) {
        expect(option.id).not.toMatch(/[{}]/);
      }
    }
  });
});
