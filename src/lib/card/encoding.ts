import { createPattern, setPunched } from "./pattern";
import { createTile, setTileCell, type Tile } from "./tile";
import { type Design } from "./design";

/**
 * Serialising a design so it can live in a URL.
 *
 * A shared link is a compatibility surface from the moment the first one is
 * sent: change the format without changing the version and every link already
 * in the wild decodes to the wrong pattern. So the version leads, and an
 * unrecognised one is a clear error rather than a misread. See ADR-0005.
 *
 * Format: `<version>.<kind>.<a>.<b>.<c>.<payload>`
 *   kind `t` — a = tile width, b = tile height, c = repeats
 *   kind `f` — a = columns,    b = rows,        c = 0
 *
 * The payload is the cells, one bit each, row-major, base64url with no padding.
 * A 24 x 48 card is 144 bytes of bits, so a link stays an ordinary URL.
 */

export const ENCODING_VERSION = 1;

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Base64url without padding. Hand-rolled so it behaves the same everywhere. */
function toBase64Url(bytes: Uint8Array): string {
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    const remaining = bytes.length - i;

    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    if (remaining > 1) out += ALPHABET[(triple >> 6) & 63];
    if (remaining > 2) out += ALPHABET[triple & 63];
  }

  return out;
}

function fromBase64Url(text: string): Uint8Array {
  const values: number[] = [];
  for (const character of text) {
    const value = ALPHABET.indexOf(character);
    if (value < 0) {
      throw new Error(`Design contains an invalid character: "${character}".`);
    }
    values.push(value);
  }

  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const remaining = values.length - i;
    const a = values[i];
    const b = i + 1 < values.length ? values[i + 1] : 0;
    const c = i + 2 < values.length ? values[i + 2] : 0;
    const d = i + 3 < values.length ? values[i + 3] : 0;
    const quad = (a << 18) | (b << 12) | (c << 6) | d;

    bytes.push((quad >> 16) & 255);
    if (remaining > 2) bytes.push((quad >> 8) & 255);
    if (remaining > 3) bytes.push(quad & 255);
  }

  return Uint8Array.from(bytes);
}

function packBits(cells: boolean[]): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(cells.length / 8));

  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) bytes[i >> 3] |= 1 << (i & 7);
  }

  return bytes;
}

function unpackBits(bytes: Uint8Array, count: number): boolean[] {
  const cells = new Array<boolean>(count);

  for (let i = 0; i < count; i++) {
    cells[i] = ((bytes[i >> 3] ?? 0) >> (i & 7)) % 2 === 1;
  }

  return cells;
}

export function encodeDesign(design: Design): string {
  if (design.kind === "tile") {
    const { tile, repeats } = design;
    return [
      ENCODING_VERSION,
      "t",
      tile.width,
      tile.height,
      repeats,
      toBase64Url(packBits(tile.cells)),
    ].join(".");
  }

  const { pattern } = design;
  return [
    ENCODING_VERSION,
    "f",
    pattern.columns,
    pattern.rows,
    0,
    toBase64Url(packBits(pattern.cells)),
  ].join(".");
}

function parsePositiveInt(raw: string, field: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Design has an invalid ${field}: "${raw}".`);
  }
  return value;
}

export function decodeDesign(encoded: string): Design {
  const parts = encoded.split(".");
  if (parts.length !== 6) {
    throw new Error(
      `Design should have 6 fields, found ${parts.length}. Is the link complete?`,
    );
  }

  const [rawVersion, kind, rawA, rawB, rawC, payload] = parts;

  const version = Number(rawVersion);
  if (version !== ENCODING_VERSION) {
    throw new Error(
      `Design uses format version ${rawVersion}, but this app understands version ${ENCODING_VERSION}. It may have been made with a newer version.`,
    );
  }

  const a = parsePositiveInt(rawA, kind === "t" ? "tile width" : "column count");
  const b = parsePositiveInt(rawB, kind === "t" ? "tile height" : "row count");
  const bytes = fromBase64Url(payload);

  const expectedBytes = Math.ceil((a * b) / 8);
  if (bytes.length !== expectedBytes) {
    throw new Error(
      `Design says ${a}x${b} but carries ${bytes.length} bytes of stitches, not ${expectedBytes}.`,
    );
  }

  const cells = unpackBits(bytes, a * b);

  if (kind === "t") {
    const repeats = parsePositiveInt(rawC, "repeat count");
    const tile: Tile = createTile(a, b);
    for (let row = 0; row < b; row++) {
      for (let column = 0; column < a; column++) {
        setTileCell(tile, row, column, cells[row * a + column]);
      }
    }
    return { kind: "tile", tile, repeats };
  }

  if (kind === "f") {
    const pattern = createPattern(a, b);
    for (let row = 0; row < b; row++) {
      for (let column = 0; column < a; column++) {
        if (cells[row * a + column]) setPunched(pattern, row, column, true);
      }
    }
    return { kind: "flat", pattern };
  }

  throw new Error(`Design has an unknown kind "${kind}".`);
}
