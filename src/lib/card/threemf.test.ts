import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { buildCardMesh } from "@/lib/card/mesh";
import { createPattern, setPunched } from "@/lib/card/pattern";
import { BROTHER_24 } from "@/lib/card/profile";
import { meshTo3mf, meshToModelXml } from "@/lib/card/threemf";

function sampleMesh() {
  const pattern = createPattern(BROTHER_24.columns, 4);
  setPunched(pattern, 1, 3, true);
  setPunched(pattern, 2, 7, true);
  return buildCardMesh(pattern, BROTHER_24);
}

describe("meshTo3mf", () => {
  it("writes the three entries a 3MF package requires", () => {
    const entries = unzipSync(meshTo3mf(sampleMesh(), "punchcard"));

    expect(Object.keys(entries).sort()).toEqual([
      "3D/3dmodel.model",
      "[Content_Types].xml",
      "_rels/.rels",
    ]);
  });

  it("declares millimetres so the slicer does not have to guess", () => {
    const entries = unzipSync(meshTo3mf(sampleMesh(), "punchcard"));
    const model = strFromU8(entries["3D/3dmodel.model"]);

    expect(model).toContain('unit="millimeter"');
  });

  it("relates the package to the model part", () => {
    const entries = unzipSync(meshTo3mf(sampleMesh(), "punchcard"));
    const rels = strFromU8(entries["_rels/.rels"]);

    expect(rels).toContain('Target="/3D/3dmodel.model"');
  });

  it("compresses — a card's XML is mostly repeated markup", () => {
    const mesh = sampleMesh();
    const archive = meshTo3mf(mesh, "punchcard");
    const rawXml = meshToModelXml(mesh, "punchcard").length;

    expect(archive.byteLength).toBeLessThan(rawXml);
  });
});

describe("meshToModelXml", () => {
  it("writes every vertex and triangle", () => {
    const mesh = sampleMesh();
    const xml = meshToModelXml(mesh, "punchcard");

    const vertices = xml.match(/<vertex /g)?.length ?? 0;
    const triangles = xml.match(/<triangle /g)?.length ?? 0;

    expect(vertices).toBe(mesh.positions.length / 3);
    expect(triangles).toBe(mesh.triangles.length / 3);
  });

  it("builds the object so the slicer places it", () => {
    const xml = meshToModelXml(sampleMesh(), "punchcard");
    expect(xml).toContain('<item objectid="1"/>');
  });

  it("escapes the object name", () => {
    const xml = meshToModelXml(sampleMesh(), 'card "A" & B');
    expect(xml).toContain("card &quot;A&quot; &amp; B");
  });

  it("writes compact numbers", () => {
    const xml = meshToModelXml(sampleMesh(), "punchcard");

    expect(xml).not.toContain(".000000");
    expect(xml).toContain('z="0.2"');
  });
});
