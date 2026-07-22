"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cloneDesign,
  designRows,
  designToPattern,
  flatten,
  smallestLegalRepeats,
  type Design,
} from "@/lib/card/design";
import { applyOrientation, type Orientation } from "@/lib/card/orientation";
import { countPunched } from "@/lib/card/pattern";
import { BROTHER_24, cardLength } from "@/lib/card/profile";
import { resizeTile, tileWidthsFor, type Tile } from "@/lib/card/tile";
import { defaultMotif } from "@/lib/card/default-motif";
import {
  clearTile,
  flipTile,
  invertTile,
  mirrorTile,
  shiftTile,
} from "@/lib/card/tile-ops";
import {
  exportDownload,
  type ExportFormat,
} from "@/lib/card/export";
import {
  describeSplit,
  minimumPieces,
  PRINTERS,
  splitCard,
} from "@/lib/card/split";

import { encodeDesign } from "@/lib/card/encoding";
import {
  autosaveProblem,
  browserStore,
  designFromFragment,
  loadAutosave,
  saveAutosave,
  saveNamed,
  type KeyValueStore,
} from "@/lib/card/storage";

import { CardPreview } from "./card-preview";
import { Library } from "./library";
import { PrintingGuide } from "./printing-guide";
import styles from "./studio.module.css";
import { TileEditor } from "./tile-editor";

const PROFILE = BROTHER_24;

function startingDesign(): Design {
  const tile = defaultMotif();
  return {
    kind: "tile",
    tile,
    repeats: smallestLegalRepeats(tile, PROFILE.minRows),
  };
}

export function Studio() {
  const [design, setDesign] = useState<Design>(startingDesign);
  const [past, setPast] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const [orientation, setOrientation] = useState<Orientation>({
    mirror: false,
    flip: false,
  });
  const [printerName, setPrinterName] = useState(PRINTERS[4].name);
  const [format, setFormat] = useState<ExportFormat>("3mf");
  const [extraPieces, setExtraPieces] = useState(0);

  // localStorage is not visible to the server, so restoring happens after
  // mount. The first paint is the default motif, replaced a frame later if
  // there is a shared link or saved work.
  const storeRef = useRef<KeyValueStore | null>(null);
  const store = (storeRef.current ??= browserStore());
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * Opening a shared pattern replaces whatever was in progress, and the next
   * edit would autosave over it. Rather than prompt, the work that was already
   * here is filed under a name first, so nothing can be lost by following a
   * link — see the review on PR #30.
   */
  const adoptShared = useCallback(
    (shared: Design) => {
      const previous = loadAutosave(store);
      if (previous && encodeDesign(previous) !== encodeDesign(shared)) {
        saveNamed(store, "Before shared link", previous);
        setNotice(
          "Opened a shared pattern. What you had before is saved below as “Before shared link”.",
        );
      }
      setDesign(shared);
      setRestoreError(null);
    },
    [store],
  );

  /*
   * Reading state the server cannot see, which is the documented exception to
   * the rule below. Initialising from localStorage during render would make the
   * server and client disagree and produce a hydration mismatch, and
   * useSyncExternalStore does not fit either — the design is state the user
   * edits, not a snapshot the store owns. This runs once on mount.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const shared = designFromFragment(globalThis.location.hash);
      if (shared) {
        adoptShared(shared);
        setRestored(true);
        return;
      }
    } catch (cause) {
      setRestoreError(
        cause instanceof Error
          ? `That share link could not be opened. ${cause.message}`
          : "That share link could not be opened.",
      );
    }

    const saved = loadAutosave(store);
    if (saved) setDesign(saved);
    else setRestoreError(autosaveProblem(store));
    setRestored(true);
  }, [store, adoptShared]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // A share link pasted into an already-open tab changes the fragment without
  // reloading, so the restore effect above never sees it. setState here is in a
  // callback responding to an external change, which is what effects are for.
  useEffect(() => {
    const onHashChange = () => {
      try {
        const shared = designFromFragment(globalThis.location.hash);
        if (!shared) return;
        adoptShared(shared);
      } catch (cause) {
        setRestoreError(
          cause instanceof Error
            ? `That share link could not be opened. ${cause.message}`
            : "That share link could not be opened.",
        );
      }
    };

    globalThis.addEventListener("hashchange", onHashChange);
    return () => globalThis.removeEventListener("hashchange", onHashChange);
  }, [adoptShared]);

  // Only after restoring, or the default would overwrite saved work before it
  // has been read back.
  // Kept current so the flush below can save the newest design without
  // resubscribing on every edit.
  const latest = useRef(design);
  useEffect(() => {
    latest.current = design;
  }, [design]);

  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(() => saveAutosave(store, design), 400);
    return () => clearTimeout(timer);
  }, [design, restored, store]);

  // The debounce would otherwise swallow the last few edits when the tab is
  // closed or navigated away from, which is exactly when they matter.
  useEffect(() => {
    if (!restored) return;
    const flush = () => saveAutosave(store, latest.current);

    globalThis.addEventListener("pagehide", flush);
    return () => {
      globalThis.removeEventListener("pagehide", flush);
      flush();
    };
  }, [restored, store]);

  const commit = useCallback(
    (next: Design) => {
      setPast((stack) => [...stack.slice(-49), cloneDesign(design)]);
      setFuture([]);
      setDesign(next);
    },
    [design],
  );

  /** Records history once per drag rather than once per stitch. */
  const [strokeOpen, setStrokeOpen] = useState(false);
  const beginStroke = useCallback(() => {
    setPast((stack) => [...stack.slice(-49), cloneDesign(design)]);
    setFuture([]);
    setStrokeOpen(true);
  }, [design]);

  const duringStroke = useCallback(
    (next: Design) => {
      if (strokeOpen) setDesign(next);
      else commit(next);
    },
    [strokeOpen, commit],
  );

  const undo = () => {
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setFuture((f) => [cloneDesign(design), ...f]);
      setDesign(previous);
      return stack.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[0];
      setPast((p) => [...p, cloneDesign(design)]);
      setDesign(next);
      return stack.slice(1);
    });
  };

  const rows = designRows(design);
  const belowMinimum = rows < PROFILE.minRows;

  const pattern = useMemo(
    () => applyOrientation(designToPattern(design, PROFILE), orientation),
    [design, orientation],
  );

  const printer = PRINTERS.find((p) => p.name === printerName) ?? PRINTERS[4];
  const fewest = minimumPieces(rows, printer, PROFILE);
  const pieceCount = fewest + extraPieces;
  const split = useMemo(
    () => splitCard(rows, pieceCount, printer, PROFILE),
    [rows, pieceCount, printer],
  );
  const seamBoundaries = split.pieces
    .slice(0, -1)
    .map((piece) => piece.lastRow + 1);

  const download = () => {
    const file = exportDownload(pattern, split, PROFILE, format);
    const blob = new Blob([file.bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadDesign = (next: Design) => {
    commit(next);
    setRestoreError(null);
  };

  const editTile = (change: (tile: Tile) => Tile) => {
    if (design.kind !== "tile") return;
    commit({ ...design, tile: change(design.tile) });
  };

  const isTile = design.kind === "tile";
  const tile = isTile ? design.tile : null;

  return (
    <div className={styles.studio}>
      {restoreError ? (
        <p className={styles.restoreError} role="alert">
          {restoreError} Your pattern is unchanged.
        </p>
      ) : null}

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      <section className={styles.panel} aria-label="Motif">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Motif</h2>
          <div className={styles.miniButtons}>
            <button type="button" onClick={undo} disabled={past.length === 0}>
              Undo
            </button>
            <button type="button" onClick={redo} disabled={future.length === 0}>
              Redo
            </button>
          </div>
        </div>

        {isTile && tile ? (
          <>
            <TileEditor
              tile={tile}
              onChange={(next) => duringStroke({ ...design, tile: next })}
              onStrokeStart={beginStroke}
            />

            <div className={styles.row}>
              <label className={styles.field}>
                <span>Stitches</span>
                <select
                  value={tile.width}
                  onChange={(event) =>
                    editTile((t) =>
                      resizeTile(t, Number(event.target.value), t.height),
                    )
                  }
                >
                  {tileWidthsFor(PROFILE.columns).map((width) => (
                    <option key={width} value={width}>
                      {width}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Rows</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={tile.height}
                  onChange={(event) => {
                    const height = Number(event.target.value);
                    if (!Number.isInteger(height) || height < 1) return;
                    editTile((t) => resizeTile(t, t.width, height));
                  }}
                />
              </label>
            </div>

            <div className={styles.tools}>
              <button type="button" onClick={() => editTile(clearTile)}>
                Clear
              </button>
              <button type="button" onClick={() => editTile(invertTile)}>
                Invert
              </button>
              <button type="button" onClick={() => editTile(mirrorTile)}>
                Mirror
              </button>
              <button type="button" onClick={() => editTile(flipTile)}>
                Flip
              </button>
              <button type="button" onClick={() => editTile((t) => shiftTile(t, 1, 0))}>
                Shift ↑
              </button>
              <button type="button" onClick={() => editTile((t) => shiftTile(t, 0, 1))}>
                Shift →
              </button>
            </div>

            <p className={styles.note}>
              Only widths that divide {PROFILE.columns} are offered, so the motif
              repeats without a break across the card.
            </p>
          </>
        ) : (
          <p className={styles.note}>
            This design has been flattened — the motif is gone and stitches are
            edited on the whole card. Reload to start a new motif.
          </p>
        )}
      </section>

      <section className={styles.panel} aria-label="Card">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Card</h2>
          <span className={styles.stat}>
            {rows} rows · {cardLength(PROFILE, rows)} mm ·{" "}
            {countPunched(pattern)} punched
          </span>
        </div>

        <CardPreview
          pattern={pattern}
          profile={PROFILE}
          seamBoundaries={seamBoundaries}
        />

        {isTile && tile ? (
          <div className={styles.row}>
            <label className={styles.field}>
              <span>Repeats</span>
              <input
                type="number"
                min={1}
                max={40}
                value={design.repeats}
                onChange={(event) => {
                  const repeats = Number(event.target.value);
                  if (!Number.isInteger(repeats) || repeats < 1) return;
                  commit({ ...design, repeats });
                }}
              />
            </label>
            <span className={styles.stat}>
              {design.repeats} × {tile.height} rows = {rows} rows
            </span>
          </div>
        ) : null}

        {belowMinimum ? (
          <p className={styles.warning} role="status">
            {rows} rows is shorter than the {PROFILE.minRows} this machine needs
            to wrap the drum. You can still export it — that minimum is a working
            figure, not a measured one.
          </p>
        ) : null}

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Printer</span>
            <select
              value={printerName}
              onChange={(event) => {
                setPrinterName(event.target.value);
                setExtraPieces(0);
              }}
            >
              {PRINTERS.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Pieces</span>
            <input
              type="number"
              min={fewest}
              max={fewest + 6}
              value={pieceCount}
              onChange={(event) => {
                const wanted = Number(event.target.value);
                if (!Number.isInteger(wanted)) return;
                setExtraPieces(Math.max(0, wanted - fewest));
              }}
            />
          </label>

          <label className={styles.field}>
            <span>Format</span>
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ExportFormat)
              }
            >
              <option value="3mf">3MF</option>
              <option value="stl">STL</option>
            </select>
          </label>
        </div>

        <p className={styles.note}>
          {describeSplit(split)}
          {split.pieces.length > 1
            ? `, each carrying ${PROFILE.overlapRows} overlap rows that duplicate the next piece. Clip them together through the loop holes.`
            : "."}
          {!split.fits
            ? " This still will not fit the bed — add more pieces."
            : ""}
        </p>

        <div className={styles.row}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={orientation.mirror}
              onChange={(event) =>
                setOrientation((o) => ({ ...o, mirror: event.target.checked }))
              }
            />
            <span>Mirror across</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={orientation.flip}
              onChange={(event) =>
                setOrientation((o) => ({ ...o, flip: event.target.checked }))
              }
            />
            <span>Flip along</span>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={download}>
            Download 3MF
          </button>
          {isTile ? (
            <button
              type="button"
              onClick={() => commit(flatten(design, PROFILE))}
            >
              Flatten
            </button>
          ) : null}
        </div>

        <p className={styles.note}>
          Flattening replaces the motif with the whole card so stitches can be
          edited one by one. It cannot be undone by re-deriving a motif — the
          card no longer says which repeat produced it.
        </p>

        <PrintingGuide profile={PROFILE} />
      </section>

      <Library design={design} onLoad={loadDesign} store={store} />
    </div>
  );
}