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

/** Matches one attribute, accepting either quote style as XML allows. */
const attributePattern = (name: string): RegExp =>
  new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`);

function readNumber(tag: string, name: string, pattern: RegExp): number {
  const match = pattern.exec(tag);
  const raw = match?.[2] ?? match?.[3];

  if (raw === undefined) {
    throw new Error(`3MF element is missing the "${name}" attribute: ${tag}`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`3MF attribute ${name}="${raw}" is not a finite number.`);
  }

  return value;
}

function parseModelXml(xml: string): Mesh {
  const positions: number[] = [];
  const triangles: number[] = [];

  const attributes = {
    x: attributePattern("x"),
    y: attributePattern("y"),
    z: attributePattern("z"),
    v1: attributePattern("v1"),
    v2: attributePattern("v2"),
    v3: attributePattern("v3"),
  };

  for (const tag of xml.match(/<vertex\b[^>]*>/g) ?? []) {
    positions.push(
      readNumber(tag, "x", attributes.x),
      readNumber(tag, "y", attributes.y),
      readNumber(tag, "z", attributes.z),
    );
  }

  const vertexCount = positions.length / 3;

  for (const tag of xml.match(/<triangle\b[^>]*>/g) ?? []) {
    for (const name of ["v1", "v2", "v3"] as const) {
      const index = readNumber(tag, name, attributes[name]);

      if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
        throw new Error(
          `3MF triangle references vertex ${index}, but the mesh has ${vertexCount}.`,
        );
      }

      triangles.push(index);
    }
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
