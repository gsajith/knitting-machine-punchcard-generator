"use client";

import { useRef, useState } from "react";

import { setTileCell, tileCell, type Tile } from "@/lib/card/tile";

import styles from "./tile-editor.module.css";

interface Props {
  tile: Tile;
  onChange: (tile: Tile) => void;
  /** Called once when a stroke begins, so undo groups a whole drag. */
  onStrokeStart: () => void;
}

interface Cursor {
  row: number;
  column: number;
}

/**
 * The motif, as an editable grid.
 *
 * Built from real buttons in a `grid` rather than a canvas, so it is operable
 * by keyboard and screen reader without reimplementing either. Only the cell
 * under the cursor is tabbable — a roving tabindex — because a full-width
 * motif would otherwise put hundreds of tab stops between this and the next
 * control.
 *
 * Row 0 of a tile is the bottom of the card, so rows are drawn in reverse: the
 * top of the screen is the top of the card.
 */
export function TileEditor({ tile, onChange, onStrokeStart }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const painting = useRef<boolean | null>(null);
  const [cursor, setCursor] = useState<Cursor>({ row: 0, column: 0 });

  const clamped = {
    row: Math.min(cursor.row, tile.height - 1),
    column: Math.min(cursor.column, tile.width - 1),
  };

  const paint = (at: Cursor, punched: boolean) => {
    if (tileCell(tile, at.row, at.column) === punched) return;

    const next: Tile = { ...tile, cells: [...tile.cells] };
    setTileCell(next, at.row, at.column, punched);
    onChange(next);
  };

  const focusCell = (at: Cursor) => {
    setCursor(at);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-row="${at.row}"][data-column="${at.column}"]`,
      )
      ?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Taken from the focused cell rather than from state: key repeat can
    // outrun React, and two arrow presses in one frame would otherwise both
    // move from the same stale position.
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-row][data-column]",
    );
    if (!cell) return;

    const from: Cursor = {
      row: Number(cell.dataset.row),
      column: Number(cell.dataset.column),
    };

    const moves: Record<string, Cursor> = {
      // Up on screen is up the card, and row 0 is the card's bottom.
      ArrowUp: { row: from.row + 1, column: from.column },
      ArrowDown: { row: from.row - 1, column: from.column },
      ArrowLeft: { row: from.row, column: from.column - 1 },
      ArrowRight: { row: from.row, column: from.column + 1 },
      Home: { row: from.row, column: 0 },
      End: { row: from.row, column: tile.width - 1 },
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    focusCell({
      row: Math.max(0, Math.min(tile.height - 1, move.row)),
      column: Math.max(0, Math.min(tile.width - 1, move.column)),
    });
  };

  const endStroke = () => {
    painting.current = null;
  };

  // Drawn top-down; row 0 of the tile is the bottom of the card.
  const displayRows = Array.from(
    { length: tile.height },
    (_, index) => tile.height - 1 - index,
  );
  const columns = Array.from({ length: tile.width }, (_, index) => index);

  return (
    <div className={styles.wrap}>
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Motif, ${tile.width} stitches by ${tile.height} rows. Arrow keys to move, space to punch.`}
        aria-rowcount={tile.height}
        aria-colcount={tile.width}
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${tile.width}, 1fr)` }}
        onKeyDown={handleKeyDown}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      >
        {displayRows.map((row) => (
          <div role="row" className={styles.row} key={row}>
            {columns.map((column) => {
              const punched = tileCell(tile, row, column);
              const isCursor = clamped.row === row && clamped.column === column;

              return (
                <button
                  type="button"
                  role="gridcell"
                  key={column}
                  data-row={row}
                  data-column={column}
                  tabIndex={isCursor ? 0 : -1}
                  aria-label={`Stitch ${column + 1}, row ${row + 1}`}
                  aria-selected={punched}
                  className={`${styles.cell} ${punched ? styles.punched : ""}`}
                  onFocus={() => setCursor({ row, column })}
                  onClick={() => paint({ row, column }, !punched)}
                  onPointerDown={(event) => {
                    // Release capture so pointerenter still fires on the cells
                    // a drag passes over.
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    onStrokeStart();
                    painting.current = !punched;
                  }}
                  onPointerEnter={() => {
                    if (painting.current === null) return;
                    paint({ row, column }, painting.current);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p className={styles.hint}>
        Stitch {clamped.column + 1}, row {clamped.row + 1} —{" "}
        {tileCell(tile, clamped.row, clamped.column) ? "punched" : "solid"}.
        Click or drag, or use arrow keys and space.
      </p>
    </div>
  );
}
