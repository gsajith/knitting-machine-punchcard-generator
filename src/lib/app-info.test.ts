import { describe, expect, it } from "vitest";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-info";

// Smoke test for the toolchain: proves Vitest runs TypeScript and that the
// "@/" path alias resolves the same way it does under Next. Alias resolution
// is configured twice (tsconfig.json and vitest.config.ts) and silently
// drifting apart is a common and confusing failure, so it is worth asserting.
describe("toolchain", () => {
  it("resolves the @/ path alias", () => {
    expect(APP_NAME).toBe("Knitting Machine Punchcard Generator");
    expect(APP_DESCRIPTION).toContain("punchcard");
  });
});
