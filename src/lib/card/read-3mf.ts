import { strFromU8, unzipSync } from "fflate";

import { type Mesh } from "./mesh";

/**
 * Reads meshes back out of a 3MF archive.
 *
 * Only what the oracle needs: geometry. Materials, colours, build transforms
 * and Bambu's own metadata are all ignored. Attributes are pulled out
 * individually rather than by a single positional pattern, because 3MF does not
 * promise an attribute order and the reference files were written by a
 * different tool than ours.
 */

const NUMBER_ATTRIBUTE = (name: string): RegExp =>
  new RegExp(`\\b${name}="([^"]*)"`);

function parseModelXml(xml: string): Mesh {
  const positions: number[] = [];
  const triangles: number[] = [];

  const xAttr = NUMBER_ATTRIBUTE("x");
  const yAttr = NUMBER_ATTRIBUTE("y");
  const zAttr = NUMBER_ATTRIBUTE("z");
  const v1Attr = NUMBER_ATTRIBUTE("v1");
  const v2Attr = NUMBER_ATTRIBUTE("v2");
  const v3Attr = NUMBER_ATTRIBUTE("v3");

  for (const tag of xml.match(/<vertex\b[^>]*>/g) ?? []) {
    positions.push(
      Number(xAttr.exec(tag)?.[1]),
      Number(yAttr.exec(tag)?.[1]),
      Number(zAttr.exec(tag)?.[1]),
    );
  }

  for (const tag of xml.match(/<triangle\b[^>]*>/g) ?? []) {
    triangles.push(
      Number(v1Attr.exec(tag)?.[1]),
      Number(v2Attr.exec(tag)?.[1]),
      Number(v3Attr.exec(tag)?.[1]),
    );
  }

  return { positions, triangles };
}

/** Concatenates meshes, shifting each one's indices to stay valid. */
export function mergeMeshes(meshes: Mesh[]): Mesh {
  const merged: Mesh = { positions: [], triangles: [] };

  for (const mesh of meshes) {
    const offset = merged.positions.length / 3;
    // Spreading here would pass a hundred thousand arguments and blow the
    // call stack — a real card has far more vertices than push() can take.
    for (const value of mesh.positions) merged.positions.push(value);
    for (const index of mesh.triangles) merged.triangles.push(index + offset);
  }

  return merged;
}

/**
 * Every mesh in a 3MF archive, in archive order.
 *
 * Bambu splits objects across `3D/Objects/*.model` and leaves `3D/3dmodel.model`
 * holding only component references, so every model part is parsed and the
 * empty ones drop out.
 */
export function read3mfMeshes(archive: Uint8Array): Mesh[] {
  const entries = unzipSync(archive);

  return Object.keys(entries)
    .filter((name) => name.endsWith(".model"))
    .sort()
    .map((name) => parseModelXml(strFromU8(entries[name])))
    .filter((mesh) => mesh.positions.length > 0);
}

/** All geometry in a 3MF archive as a single mesh. */
export function read3mf(archive: Uint8Array): Mesh {
  const meshes = read3mfMeshes(archive);

  if (meshes.length === 0) {
    throw new Error("3MF archive contains no mesh geometry.");
  }

  return mergeMeshes(meshes);
}
