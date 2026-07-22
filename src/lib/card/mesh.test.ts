import { describe, expect, it } from "vitest";

import { demoPattern } from "@/lib/card/demo-pattern";
import {
  boundingBox,
  buildCardMesh,
  countUnpairedEdges,
  isWatertight,
} from "@/lib/card/mesh";
import { createPattern, setPunched } from "@/lib/card/pattern";
import { BROTHER_24, BROTHER_24_CLASSIC, webThickness } from "@/lib/card/profile";

const ROWS = 6;

function blankCard() {
  return buildCardMesh(createPattern(BROTHER_24.columns, ROWS), BROTHER_24);
}

describe("buildCardMesh", () => {
  it("produces a closed mesh with no holes punched", () => {
    expect(countUnpairedEdges(blankCard())).toBe(0);
  });

  it("produces a closed mesh with every stitch punched", () => {
    const pattern = createPattern(BROTHER_24.columns, ROWS, true);
    expect(isWatertight(buildCardMesh(pattern, BROTHER_24))).toBe(true);
  });

  it("stays closed for holes at the card's corners and edges", () => {
    const pattern = createPattern(BROTHER_24.columns, ROWS);
    setPunched(pattern, 0, 0, true);
    setPunched(pattern, 0, BROTHER_24.columns - 1, true);
    setPunched(pattern, ROWS - 1, 0, true);
    setPunched(pattern, ROWS - 1, BROTHER_24.columns - 1, true);

    expect(isWatertight(buildCardMesh(pattern, BROTHER_24))).toBe(true);
  });

  it("stays closed for a realistic tiled pattern", () => {
    const mesh = buildCardMesh(demoPattern(BROTHER_24, 40), BROTHER_24);
    expect(isWatertight(mesh)).toBe(true);
  });

  it("stays closed with round holes as well as elongated ones", () => {
    const pattern = createPattern(BROTHER_24_CLASSIC.columns, ROWS, true);
    expect(
      isWatertight(buildCardMesh(pattern, BROTHER_24_CLASSIC)),
    ).toBe(true);
  });

  it("has the card's outer dimensions", () => {
    const { min, max } = boundingBox(blankCard());

    expect(max[0] - min[0]).toBeCloseTo(BROTHER_24.cardWidth, 6);
    expect(max[1] - min[1]).toBeCloseTo(ROWS * BROTHER_24.rowPitch, 6);
    expect(max[2] - min[2]).toBeCloseTo(BROTHER_24.thickness, 6);
  });

  it("sits on the build plate", () => {
    const { min, max } = boundingBox(blankCard());
    expect(min[2]).toBeCloseTo(0, 6);
    expect(max[2]).toBeCloseTo(BROTHER_24.thickness, 6);
  });

  it("is centred on the origin in X and Y", () => {
    const { min, max } = boundingBox(blankCard());
    expect(min[0] + max[0]).toBeCloseTo(0, 6);
    expect(min[1] + max[1]).toBeCloseTo(0, 6);
  });

  it("adds geometry for each punched stitch", () => {
    const blank = blankCard();

    const pattern = createPattern(BROTHER_24.columns, ROWS);
    setPunched(pattern, 2, 5, true);
    const punched = buildCardMesh(pattern, BROTHER_24);

    expect(punched.triangles.length).toBeGreaterThan(blank.triangles.length);
  });

  it("indexes only vertices that exist", () => {
    const mesh = blankCard();
    const vertexCount = mesh.positions.length / 3;

    for (const index of mesh.triangles) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(vertexCount);
    }
  });

  it("emits no degenerate triangles", () => {
    const pattern = createPattern(BROTHER_24.columns, ROWS, true);
    const mesh = buildCardMesh(pattern, BROTHER_24);

    for (let t = 0; t < mesh.triangles.length; t += 3) {
      const [a, b, c] = [
        mesh.triangles[t],
        mesh.triangles[t + 1],
        mesh.triangles[t + 2],
      ];
      expect(a === b || b === c || c === a).toBe(false);
    }
  });
});

describe("webThickness", () => {
  it("reports the horizontal web as the weak axis", () => {
    const web = webThickness(BROTHER_24);

    expect(web.horizontal).toBeCloseTo(1.25, 6);
    expect(web.vertical).toBeCloseTo(1.25, 6);
  });

  it("shows the classic round hole leaving a thinner horizontal web", () => {
    const web = webThickness(BROTHER_24_CLASSIC);

    expect(web.horizontal).toBeCloseTo(0.75, 6);
    expect(web.horizontal).toBeLessThan(web.vertical);
  });
});
