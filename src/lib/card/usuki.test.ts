import { describe, expect, it } from "vitest";

import { BROTHER_24 } from "@/lib/card/profile";
import { countTilePunched } from "@/lib/card/tile";
import { usukiTile, USUKI_HEIGHT, USUKI_WIDTH } from "@/lib/card/usuki";

describe("usuki motif", () => {
  it("fills the card's full width in a single repeat", () => {
    expect(USUKI_WIDTH).toBe(BROTHER_24.columns);
  });

  it("is long enough to wrap the drum on its own", () => {
    expect(USUKI_HEIGHT).toBeGreaterThanOrEqual(BROTHER_24.minRows);
  });

  it("is neither blank nor solid", () => {
    const tile = usukiTile();
    const punched = countTilePunched(tile);

    expect(tile.cells).toHaveLength(USUKI_WIDTH * USUKI_HEIGHT);
    expect(punched).toBeGreaterThan(0);
    expect(punched).toBeLessThan(tile.cells.length);
  });
});
