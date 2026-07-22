import { describe, expect, it } from "vitest";

import { type Design } from "@/lib/card/design";
import { encodeDesign } from "@/lib/card/encoding";
import { createTile, setTileCell } from "@/lib/card/tile";
import {
  clearAutosave,
  deleteSaved,
  designFromFragment,
  designFromJson,
  designToFragment,
  designToJson,
  listSaved,
  loadAutosave,
  loadSaved,
  memoryStore,
  renameSaved,
  saveAutosave,
  saveNamed,
  STORAGE_VERSION,
  type KeyValueStore,
} from "@/lib/card/storage";

function motif(): Design {
  const tile = createTile(8, 8);
  setTileCell(tile, 0, 0, true);
  setTileCell(tile, 3, 5, true);
  return { kind: "tile", tile, repeats: 5 };
}

/** A store that refuses to write, like Safari in private mode at quota. */
function hostileStore(): KeyValueStore {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("nope");
    },
  };
}

describe("autosave", () => {
  it("round-trips the working design", () => {
    const store = memoryStore();
    saveAutosave(store, motif());

    expect(loadAutosave(store)).toEqual(motif());
  });

  it("returns null when there is nothing saved", () => {
    expect(loadAutosave(memoryStore())).toBeNull();
  });

  it("can be cleared", () => {
    const store = memoryStore();
    saveAutosave(store, motif());
    clearAutosave(store);

    expect(loadAutosave(store)).toBeNull();
  });

  it("ignores an envelope from a future version", () => {
    const store = memoryStore();
    store.setItem(
      "punchcard.autosave",
      JSON.stringify({ v: STORAGE_VERSION + 1, data: encodeDesign(motif()) }),
    );

    expect(loadAutosave(store)).toBeNull();
  });

  it("ignores a design it cannot decode rather than guessing", () => {
    const store = memoryStore();
    store.setItem(
      "punchcard.autosave",
      JSON.stringify({ v: STORAGE_VERSION, data: "9.t.8.8.5.AAAA" }),
    );

    expect(loadAutosave(store)).toBeNull();
  });

  it("survives corrupt JSON", () => {
    const store = memoryStore();
    store.setItem("punchcard.autosave", "{not json");

    expect(loadAutosave(store)).toBeNull();
  });

  // Losing a pattern is bad; a blank screen is worse.
  it("reports failure instead of throwing when storage refuses", () => {
    expect(saveAutosave(hostileStore(), motif())).toBe(false);
    expect(() => clearAutosave(hostileStore())).not.toThrow();
    expect(loadAutosave(hostileStore())).toBeNull();
  });
});

describe("named library", () => {
  it("starts empty", () => {
    expect(listSaved(memoryStore())).toEqual([]);
  });

  it("saves, lists and loads by name", () => {
    const store = memoryStore();
    const items = saveNamed(store, "Hearts", motif());

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Hearts");
    expect(loadSaved(store, items[0].id)).toEqual(motif());
  });

  it("keeps several and lists newest first", () => {
    const store = memoryStore();
    saveNamed(store, "First", motif());
    const items = saveNamed(store, "Second", motif());

    expect(items.map((item) => item.name)).toEqual(["Second", "First"]);
  });

  it("renames without touching the design", () => {
    const store = memoryStore();
    const [saved] = saveNamed(store, "Old", motif());
    const items = renameSaved(store, saved.id, "New");

    expect(items[0].name).toBe("New");
    expect(loadSaved(store, saved.id)).toEqual(motif());
  });

  it("falls back to a name rather than accepting an empty one", () => {
    const store = memoryStore();
    const [saved] = saveNamed(store, "   ", motif());
    expect(saved.name).toBe("Untitled");

    const renamed = renameSaved(store, saved.id, "  ");
    expect(renamed[0].name).toBe("Untitled");
  });

  it("deletes", () => {
    const store = memoryStore();
    const [saved] = saveNamed(store, "Hearts", motif());

    expect(deleteSaved(store, saved.id)).toEqual([]);
    expect(loadSaved(store, saved.id)).toBeNull();
  });

  it("overwrites in place when saving over an existing entry", () => {
    const store = memoryStore();
    const [saved] = saveNamed(store, "Hearts", motif());

    const blank: Design = { kind: "tile", tile: createTile(8, 8), repeats: 5 };
    const items = saveNamed(store, "Hearts", blank, saved.id);

    expect(items).toHaveLength(1);
    expect(loadSaved(store, saved.id)).toEqual(blank);
  });

  it("skips entries that are not shaped like saved designs", () => {
    const store = memoryStore();
    store.setItem(
      "punchcard.library",
      JSON.stringify({ v: STORAGE_VERSION, data: [{ nonsense: true }, null] }),
    );

    expect(listSaved(store)).toEqual([]);
  });

  it("ignores a library from a future version", () => {
    const store = memoryStore();
    store.setItem(
      "punchcard.library",
      JSON.stringify({ v: STORAGE_VERSION + 1, data: [] }),
    );

    expect(listSaved(store)).toEqual([]);
  });
});

describe("share links", () => {
  it("round-trips through a fragment", () => {
    expect(designFromFragment(designToFragment(motif()))).toEqual(motif());
  });

  it("stays an ordinary length", () => {
    expect(designToFragment(motif()).length).toBeLessThan(60);
  });

  it("returns null when the fragment holds no design", () => {
    expect(designFromFragment("")).toBeNull();
    expect(designFromFragment("#")).toBeNull();
    expect(designFromFragment("#other=1")).toBeNull();
  });

  it("finds the design alongside other fragment parameters", () => {
    const fragment = `#tab=card&d=${encodeDesign(motif())}`;
    expect(designFromFragment(fragment)).toEqual(motif());
  });

  // No design and an unreadable design are different situations.
  it("throws on a design it cannot read", () => {
    expect(() => designFromFragment("#d=9.t.8.8.5.AAAA")).toThrow(/version/i);
    expect(() => designFromFragment("#d=garbage")).toThrow();
  });
});

describe("json files", () => {
  it("round-trips", () => {
    expect(designFromJson(designToJson(motif()))).toEqual(motif());
  });

  it("is readable, with a trailing newline", () => {
    const text = designToJson(motif());
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('"format": "knitting-machine-punchcard"');
  });

  it("rejects files from other apps", () => {
    expect(() => designFromJson('{"format":"something-else"}')).toThrow(
      /not written by this app/,
    );
  });

  it("rejects a future file format", () => {
    const text = designToJson(motif()).replace(
      `"version": ${STORAGE_VERSION}`,
      `"version": ${STORAGE_VERSION + 1}`,
    );
    expect(() => designFromJson(text)).toThrow(/version/);
  });

  it("rejects nonsense", () => {
    expect(() => designFromJson("not json at all")).toThrow(/valid JSON/);
    expect(() =>
      designFromJson(
        JSON.stringify({ format: "knitting-machine-punchcard", version: 1 }),
      ),
    ).toThrow(/no design/);
  });
});
