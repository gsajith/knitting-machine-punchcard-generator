"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { type Design } from "@/lib/card/design";
import {
  deleteSaved,
  designFromJson,
  designToFragment,
  designToJson,
  findByName,
  librarySnapshot,
  libraryServerSnapshot,
  loadSaved,
  renameSaved,
  saveNamed,
  subscribeLibrary,
  type KeyValueStore,
  type SavedDesign,
} from "@/lib/card/storage";

import styles from "./library.module.css";

interface Props {
  design: Design;
  onLoad: (design: Design) => void;
  store: KeyValueStore;
}

type Status = { tone: "ok" | "error"; text: string } | null;

export function Library({ design, onLoad, store }: Props) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The library lives in localStorage, which the server cannot see. Reading it
  // as an external store avoids both a hydration mismatch and a copy of the
  // list in component state that could drift from what is stored.
  const items = useSyncExternalStore(
    subscribeLibrary,
    useCallback(() => librarySnapshot(store), [store]),
    libraryServerSnapshot,
  );

  const report = (tone: "ok" | "error", text: string) =>
    setStatus({ tone, text });

  const handleSave = () => {
    const existing = findByName(store, name);
    const { ok } = saveNamed(store, name, design, existing);

    if (!ok) {
      report("error", "This browser refused to save — storage may be full.");
      return;
    }

    setName("");
    report("ok", existing ? "Replaced the pattern of that name." : "Saved.");
  };

  const handleLoad = (item: SavedDesign) => {
    const loaded = loadSaved(store, item.id);
    if (!loaded) {
      report("error", `“${item.name}” could not be read.`);
      return;
    }
    onLoad(loaded);
    report("ok", `Loaded “${item.name}”.`);
  };

  const handleRename = (item: SavedDesign) => {
    const next = globalThis.prompt("Rename pattern", item.name);
    if (next === null) return;

    const { ok } = renameSaved(store, item.id, next);
    report(ok ? "ok" : "error", ok ? "Renamed." : "Could not rename.");
  };

  const handleDelete = (item: SavedDesign) => {
    const sure = globalThis.confirm(
      `Delete “${item.name}”? This cannot be undone.`,
    );
    if (!sure) return;

    const { ok } = deleteSaved(store, item.id);
    report(
      ok ? "ok" : "error",
      ok ? `Deleted “${item.name}”.` : "Could not delete.",
    );
  };

  /*
   * The link is deliberately not written into the address bar. A fragment left
   * there outlives the share: a reload hours later would restore the pattern as
   * it was at the moment of sharing and then autosave over everything since.
   */
  const handleShare = async () => {
    const url = `${globalThis.location.origin}${globalThis.location.pathname}${designToFragment(design)}`;

    try {
      await globalThis.navigator.clipboard.writeText(url);
      setShareLink(null);
      report("ok", "Link copied. It carries the whole pattern.");
    } catch {
      setShareLink(url);
      report("ok", "Copy this link — it carries the whole pattern.");
    }
  };

  const handleExport = () => {
    const blob = new Blob([designToJson(design)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "punchcard.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      onLoad(designFromJson(await file.text()));
      report("ok", `Loaded ${file.name}.`);
    } catch (cause) {
      report(
        "error",
        cause instanceof Error ? cause.message : "That file could not be read.",
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <section className={styles.panel} aria-label="Saved patterns">
      <div className={styles.head}>
        <h2 className={styles.title}>Patterns</h2>
        <span className={styles.privacy}>
          Everything stays on this device — nothing is uploaded.
        </span>
      </div>

      <div className={styles.saveRow}>
        <label className={styles.field}>
          <span>Name</span>
          <input
            type="text"
            value={name}
            placeholder="Untitled"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSave();
            }}
          />
        </label>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <button type="button" onClick={handleShare}>
          Copy share link
        </button>
        <button type="button" onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className={styles.fileInput}
          onChange={(event) => handleImport(event.target.files?.[0])}
        />
      </div>

      <p
        className={status?.tone === "error" ? styles.error : styles.status}
        role="status"
      >
        {status?.text ?? ""}
      </p>

      {shareLink ? (
        <input
          className={styles.shareLink}
          type="text"
          readOnly
          value={shareLink}
          aria-label="Share link"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}

      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing saved yet. Your work is kept as you go — a refresh will not
          lose it — but saving under a name lets you keep more than one.
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemName}>{item.name}</span>
              <span className={styles.itemActions}>
                <button type="button" onClick={() => handleLoad(item)}>
                  Load
                </button>
                <button type="button" onClick={() => handleRename(item)}>
                  Rename
                </button>
                <button type="button" onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
