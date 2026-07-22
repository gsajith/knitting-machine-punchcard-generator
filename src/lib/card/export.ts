import { zipSync } from "fflate";

import { buildCardMesh } from "./mesh";
import { type Pattern } from "./pattern";
import { type CardProfile } from "./profile";
import { piecePattern, type Split } from "./split";
import { meshToStl } from "./stl";
import { meshTo3mf } from "./threemf";

export type ExportFormat = "3mf" | "stl";

export interface ExportFile {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * Builds the files to download.
 *
 * One file per piece. A single-piece card downloads as one model; a split card
 * downloads as a zip, so each piece is unambiguously its own print rather than
 * relying on a slicer to interpret plate metadata.
 */
export function exportFiles(
  pattern: Pattern,
  split: Split,
  profile: CardProfile,
  format: ExportFormat,
): ExportFile[] {
  const single = split.pieces.length === 1;

  return split.pieces.map((piece, index) => {
    const mesh = buildCardMesh(piecePattern(pattern, piece), profile);
    const name = single
      ? `punchcard-${piece.rows}-rows.${format}`
      : `punchcard-piece-${index + 1}-of-${split.pieces.length}.${format}`;

    return {
      name,
      bytes:
        format === "3mf"
          ? meshTo3mf(mesh, name.replace(/\.[^.]+$/, ""))
          : meshToStl(mesh),
    };
  });
}

/** Packs several files into a zip. */
export function zipFiles(files: ExportFile[]): Uint8Array<ArrayBuffer> {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = file.bytes;
  return zipSync(entries, { level: 6 }) as Uint8Array<ArrayBuffer>;
}

/** The single blob a download produces, zipping only when there is more than one piece. */
export function exportDownload(
  pattern: Pattern,
  split: Split,
  profile: CardProfile,
  format: ExportFormat,
): ExportFile {
  const files = exportFiles(pattern, split, profile, format);
  if (files.length === 1) return files[0];

  return {
    name: `punchcard-${files.length}-pieces-${format}.zip`,
    bytes: zipFiles(files),
  };
}
