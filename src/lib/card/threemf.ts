import { strToU8, zipSync } from "fflate";

import { type Mesh } from "./mesh";

/**
 * Formats a millimetre value for 3MF. Trailing zeros are stripped to keep the
 * XML small — a full card runs to hundreds of thousands of numbers.
 */
function mm(value: number): string {
  const fixed = value.toFixed(6).replace(/\.?0+$/, "");
  return fixed === "-0" || fixed === "" ? "0" : fixed;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

const RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function meshToModelXml(mesh: Mesh, name: string): string {
  const parts: string[] = [];

  parts.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  parts.push(
    '<model unit="millimeter" xml:lang="en-US" ' +
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
  );
  parts.push(' <resources>\n');
  parts.push(`  <object id="1" type="model" name="${escapeXml(name)}">\n`);
  parts.push("   <mesh>\n    <vertices>\n");

  for (let i = 0; i < mesh.positions.length; i += 3) {
    parts.push(
      `     <vertex x="${mm(mesh.positions[i])}" y="${mm(mesh.positions[i + 1])}" z="${mm(mesh.positions[i + 2])}"/>\n`,
    );
  }

  parts.push("    </vertices>\n    <triangles>\n");

  for (let t = 0; t < mesh.triangles.length; t += 3) {
    parts.push(
      `     <triangle v1="${mesh.triangles[t]}" v2="${mesh.triangles[t + 1]}" v3="${mesh.triangles[t + 2]}"/>\n`,
    );
  }

  parts.push("    </triangles>\n   </mesh>\n  </object>\n </resources>\n");
  parts.push(' <build>\n  <item objectid="1"/>\n </build>\n</model>\n');

  return parts.join("");
}

/**
 * Packages a mesh as a 3MF archive, ready to open in a slicer.
 *
 * Narrowed to `Uint8Array<ArrayBuffer>` so the result can be handed straight to
 * `Blob`. fflate allocates an ordinary ArrayBuffer, never a SharedArrayBuffer,
 * so this states what is already true rather than hiding anything.
 */
export function meshTo3mf(mesh: Mesh, name: string): Uint8Array<ArrayBuffer> {
  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(RELATIONSHIPS),
      "3D/3dmodel.model": strToU8(meshToModelXml(mesh, name)),
    },
    { level: 6 },
  ) as Uint8Array<ArrayBuffer>;
}
