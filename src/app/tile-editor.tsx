"use client";

import { useRef, useState } from "react";

import { setTileCell, tileCell, type Tile } from "@/lib/card/tile";

import styles from "./tile-editor.module.css";

const CELL = 26;

interface Props {
  tile: Tile;
  onChange: (tile: Tile) => void;
  /** Called once when a stroke begins, so undo groups a whole drag. */
  onStrokeStart: () => void;
}

export function TileEditor({ tile, onChange, onStrokeStart }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const painting = useRef<boolean | null>(null);
  const [cursor, setCursor] = useState<{ row: number; column: number } | null>(
    null,
  );

  const width = tile.width * CELL;
  const height = tile.height * CELL;

  const cellAt = (event: React.PointerEvent): { row: number; column: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;

    const box = svg.getBoundingClientRect();
    const column = Math.floor(((event.clientX - box.left) / box.width) * tile.width);
    const row = Math.floor(((event.clientY - box.top) / box.height) * tile.height);

    if (row < 0 || row >= tile.height || column < 0 || column >= tile.width) {
      return null;
    }
    // Row 0 is the bottom of the card, but the top of the screen is the top of
    // the card, so the y axis is inverted for display.
    return { row: tile.height - 1 - row, column };
  };

  const paint = (at: { row: number; column: number }, punched: boolean) => {
    if (tileCell(tile, at.row, at.column) === punched) return;

    const next: Tile = { ...tile, cells: [...tile.cells] };
    setTileCell(next, at.row, at.column, punched);
    onChange(next);
  };

  const handleDown = (event: React.PointerEvent) => {
    const at = cellAt(event);
    if (!at) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    onStrokeStart();
    painting.current = !tileCell(tile, at.row, at.column);
    paint(at, painting.current);
  };

  const handleMove = (event: React.PointerEvent) => {
    const at = cellAt(event);
    setCursor(at);
    if (painting.current === null || !at) return;
    paint(at, painting.current);
  };

  const endStroke = () => {
    painting.current = null;
  };

  const rows = Array.from({ length: tile.height }, (_, i) => i);
  const columns = Array.from({ length: tile.width }, (_, i) => i);

  return (
    <div className={styles.wrap}>
      <svg
        ref={svgRef}
        className={styles.grid}
        viewBox={`0 0 ${width} ${height}`}
        style={{ aspectRatio: `${tile.width} / ${tile.height}` }}
        role="img"
        aria-label={`Motif, ${tile.width} stitches by ${tile.height} rows`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={() => setCursor(null)}
      >
        {rows.map((displayRow) =>
          columns.map((column) => {
            const row = tile.height - 1 - displayRow;
            const punched = tileCell(tile, row, column);
            const hovered =
              cursor?.row === row && cursor?.column === column;

            return (
              <rect
                key={`${row}-${column}`}
                x={column * CELL}
                y={displayRow * CELL}
                width={CELL}
                height={CELL}
                className={[
                  styles.cell,
                  punched ? styles.punched : "",
                  hovered ? styles.hovered : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          }),
        )}
      </svg>

      <p className={styles.hint}>
        {cursor
          ? `stitch ${cursor.column + 1}, row ${cursor.row + 1}`
          : "Click or drag to punch"}
      </p>
    </div>
  );
}
