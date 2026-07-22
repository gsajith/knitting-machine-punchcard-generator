import { decodeDesign, encodeDesign } from "./encoding";
import { type Design } from "./design";

/**
 * Saving, sharing and loading designs — entirely on the user's machine.
 *
 * Nothing here makes a network request. A design is encoded with the versioned
 * format from `encoding.ts`, so every stored value and every share link carries
 * the version that wrote it and a future format fails loudly rather than
 * decoding into the wrong pattern. See ADR-0005.
 */

/** Bumped only when the envelope around the design changes, not the design. */
export const STORAGE_VERSION = 1;

const AUTOSAVE_KEY = "punchcard.autosave";
const LIBRARY_KEY = "punchcard.library";

/** The slice of the Storage API this module needs, so it can be tested. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SavedDesign {
  id: string;
  name: string;
  /** The design, in the versioned encoding. */
  encoded: string;
  savedAt: number;
}

/** An in-memory store, for tests and for browsers that refuse localStorage. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/**
 * The browser's localStorage, or a memory store if it is unavailable.
 *
 * Safari in private mode and some embedded browsers throw on access rather than
 * returning null, and losing a pattern is better than a blank screen.
 */
export function browserStore(): KeyValueStore {
  try {
    const probe = "punchcard.probe";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return memoryStore();
  }
}

function readJson<T>(store: KeyValueStore, key: string): T | null {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exhausted, or storage disabled mid-session.
    return false;
  }
}

interface Envelope<T> {
  v: number;
  data: T;
}

// --- autosave -------------------------------------------------------------

export function saveAutosave(store: KeyValueStore, design: Design): boolean {
  return writeJson(store, AUTOSAVE_KEY, {
    v: STORAGE_VERSION,
    data: encodeDesign(design),
  } satisfies Envelope<string>);
}

/** The last working design, or null if there isn't a usable one. */
export function loadAutosave(store: KeyValueStore): Design | null {
  const envelope = readJson<Envelope<string>>(store, AUTOSAVE_KEY);
  if (!envelope || envelope.v !== STORAGE_VERSION) return null;

  try {
    return decodeDesign(envelope.data);
  } catch {
    // A design written by a newer version of the app. Start fresh rather than
    // showing something that isn't what was saved.
    return null;
  }
}

/**
 * Why the stored working pattern could not be used, if it could not.
 *
 * Rejecting a future version is right, but replacing it on the next keystroke
 * without saying so is not — the user would never learn their work was there.
 */
export function autosaveProblem(store: KeyValueStore): string | null {
  const envelope = readJson<Envelope<string>>(store, AUTOSAVE_KEY);
  if (!envelope) return null;

  if (envelope.v !== STORAGE_VERSION) {
    return `Saved work here was written by a newer version of this app (format ${envelope.v}), so it could not be opened.`;
  }

  try {
    decodeDesign(envelope.data);
    return null;
  } catch (cause) {
    return `Saved work here could not be read. ${cause instanceof Error ? cause.message : ""}`.trim();
  }
}

export function clearAutosave(store: KeyValueStore): void {
  try {
    store.removeItem(AUTOSAVE_KEY);
  } catch {
    // Nothing useful to do; the caller cannot fix it either.
  }
}

// --- named library --------------------------------------------------------

export function listSaved(store: KeyValueStore): SavedDesign[] {
  const envelope = readJson<Envelope<SavedDesign[]>>(store, LIBRARY_KEY);
  if (!envelope || envelope.v !== STORAGE_VERSION) return [];
  if (!Array.isArray(envelope.data)) return [];

  return envelope.data
    .filter(
      (item): item is SavedDesign =>
        typeof item?.id === "string" &&
        typeof item?.name === "string" &&
        typeof item?.encoded === "string",
    )
    .map((item) => ({
      ...item,
      savedAt: Number.isFinite(item.savedAt) ? item.savedAt : 0,
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

function writeLibrary(store: KeyValueStore, items: SavedDesign[]): boolean {
  const written = writeJson(store, LIBRARY_KEY, {
    v: STORAGE_VERSION,
    data: items,
  } satisfies Envelope<SavedDesign[]>);
  invalidateLibrary();
  return written;
}

/**
 * Subscription plumbing, so React can read the library with
 * `useSyncExternalStore` rather than copying it into state after mount.
 *
 * Snapshots are cached because `useSyncExternalStore` compares them by
 * identity: returning a freshly built array every read would loop forever.
 */
const listeners = new Set<() => void>();
const EMPTY: readonly SavedDesign[] = Object.freeze([]);

let cached: SavedDesign[] | null = null;
let cachedFrom: KeyValueStore | null = null;

function invalidateLibrary(): void {
  cached = null;
  for (const listener of listeners) listener();
}

export function subscribeLibrary(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab editing the same library counts as a change here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LIBRARY_KEY) invalidateLibrary();
  };
  globalThis.addEventListener?.("storage", onStorage);

  return () => {
    listeners.delete(listener);
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

/** A stable snapshot of the library, rebuilt only when it actually changes. */
export function librarySnapshot(store: KeyValueStore): SavedDesign[] {
  if (cached === null || cachedFrom !== store) {
    cached = listSaved(store);
    cachedFrom = store;
  }
  return cached;
}

/** The library as the server sees it: empty, because storage is client-only. */
export function libraryServerSnapshot(): SavedDesign[] {
  return EMPTY as SavedDesign[];
}

export interface WriteResult {
  items: SavedDesign[];
  /** False when storage refused the write — quota, or disabled mid-session. */
  ok: boolean;
}

export function saveNamed(
  store: KeyValueStore,
  name: string,
  design: Design,
  id = newId(),
): WriteResult {
  const trimmed = name.trim() || "Untitled";
  const others = listSaved(store).filter((item) => item.id !== id);
  const items = [
    { id, name: trimmed, encoded: encodeDesign(design), savedAt: Date.now() },
    ...others,
  ];

  const ok = writeLibrary(store, items);
  return { items: listSaved(store), ok };
}

/** The id of an existing entry with this name, so saving twice overwrites. */
export function findByName(
  store: KeyValueStore,
  name: string,
): string | undefined {
  const trimmed = name.trim() || "Untitled";
  return listSaved(store).find((item) => item.name === trimmed)?.id;
}

export function renameSaved(
  store: KeyValueStore,
  id: string,
  name: string,
): WriteResult {
  const items = listSaved(store).map((item) =>
    item.id === id ? { ...item, name: name.trim() || item.name } : item,
  );
  const ok = writeLibrary(store, items);
  return { items: listSaved(store), ok };
}

export function deleteSaved(store: KeyValueStore, id: string): WriteResult {
  const ok = writeLibrary(
    store,
    listSaved(store).filter((item) => item.id !== id),
  );
  return { items: listSaved(store), ok };
}

export function loadSaved(store: KeyValueStore, id: string): Design | null {
  const item = listSaved(store).find((saved) => saved.id === id);
  if (!item) return null;

  try {
    return decodeDesign(item.encoded);
  } catch {
    return null;
  }
}

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- sharing --------------------------------------------------------------

/** The fragment part of a share link, including the leading hash. */
export function designToFragment(design: Design): string {
  return `#d=${encodeDesign(design)}`;
}

/**
 * Reads a design out of a URL fragment.
 *
 * Returns null when there is no design in the fragment, and throws when there
 * is one that cannot be read — those are different situations and the caller
 * should only apologise for the second.
 */
export function designFromFragment(fragment: string): Design | null {
  const match = /(?:^#?|&)d=([^&]+)/.exec(fragment);
  if (!match) return null;

  return decodeDesign(decodeURIComponent(match[1]));
}

// --- json file ------------------------------------------------------------

export const FILE_FORMAT = "knitting-machine-punchcard";

interface DesignFile {
  format: string;
  version: number;
  design: string;
}

export function designToJson(design: Design): string {
  return `${JSON.stringify(
    {
      format: FILE_FORMAT,
      version: STORAGE_VERSION,
      design: encodeDesign(design),
    } satisfies DesignFile,
    null,
    2,
  )}\n`;
}

export function designFromJson(text: string): Design {
  let parsed: Partial<DesignFile>;
  try {
    parsed = JSON.parse(text) as Partial<DesignFile>;
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  if (parsed.format !== FILE_FORMAT) {
    throw new Error("That file was not written by this app.");
  }
  if (parsed.version !== STORAGE_VERSION) {
    throw new Error(
      `That file uses format version ${parsed.version}, but this app understands version ${STORAGE_VERSION}.`,
    );
  }
  if (typeof parsed.design !== "string") {
    throw new Error("That file has no design in it.");
  }

  return decodeDesign(parsed.design);
}
