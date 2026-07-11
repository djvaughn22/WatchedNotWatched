import { describe, expect, it } from "vitest";
import {
  emptyStore,
  getEntry,
  inView,
  migrateLegacy,
  removeEntries,
  removeEntry,
  restoreEntries,
  sanitizeStore,
  setAgain,
  setMyTake,
  setStatus,
  type LibraryEntry,
  type TitleRef,
} from "./library";

const ref = (id: string, title = "Title"): TitleRef => ({
  id,
  source: "tmdb",
  sourceId: id.split(":")[1],
  mediaType: "movie",
  title,
});

describe("setStatus", () => {
  it("adds a new want_to_watch entry at the front", () => {
    let store = emptyStore();
    store = setStatus(store, ref("tmdb:1", "A"), "want_to_watch", "2026-01-01T00:00:00Z");
    store = setStatus(store, ref("tmdb:2", "B"), "want_to_watch", "2026-01-02T00:00:00Z");
    expect(store.entries.map((e) => e.id)).toEqual(["tmdb:2", "tmdb:1"]);
    expect(store.entries[0].status).toBe("want_to_watch");
    expect(store.entries[0].watchedAt).toBeUndefined();
  });

  it("sets watchedAt the first time a title becomes watched, then keeps it", () => {
    let store = setStatus(emptyStore(), ref("tmdb:1"), "watched", "2026-01-01T00:00:00Z");
    expect(store.entries[0].watchedAt).toBe("2026-01-01T00:00:00Z");
    store = setStatus(store, ref("tmdb:1"), "want_to_watch", "2026-01-02T00:00:00Z");
    store = setStatus(store, ref("tmdb:1"), "watched", "2026-01-03T00:00:00Z");
    expect(store.entries[0].watchedAt).toBe("2026-01-01T00:00:00Z");
    expect(store.entries).toHaveLength(1);
  });

  it("keeps My Take and Again when moving between statuses", () => {
    let store = setStatus(emptyStore(), ref("tmdb:1"), "watched");
    store = setMyTake(store, "tmdb:1", "loved");
    store = setAgain(store, "tmdb:1", "yes");
    store = setStatus(store, ref("tmdb:1"), "want_to_watch");
    expect(getEntry(store, "tmdb:1")?.myTake).toBe("loved");
    expect(getEntry(store, "tmdb:1")?.again).toBe("yes");
  });
});

describe("verdicts", () => {
  it("sets and clears My Take and Again", () => {
    let store = setStatus(emptyStore(), ref("tmdb:1"), "watched");
    store = setMyTake(store, "tmdb:1", "fine");
    expect(getEntry(store, "tmdb:1")?.myTake).toBe("fine");
    store = setMyTake(store, "tmdb:1", undefined);
    expect(getEntry(store, "tmdb:1")?.myTake).toBeUndefined();
    store = setAgain(store, "tmdb:1", "maybe");
    expect(getEntry(store, "tmdb:1")?.again).toBe("maybe");
  });
});

describe("remove / restore", () => {
  it("removes one and many, and restores for undo without duplicating", () => {
    let store = emptyStore();
    for (const n of [1, 2, 3]) store = setStatus(store, ref(`tmdb:${n}`), "watched");
    const removed = store.entries.filter((e) => e.id !== "tmdb:2");
    store = removeEntries(store, ["tmdb:1", "tmdb:3"]);
    expect(store.entries.map((e) => e.id)).toEqual(["tmdb:2"]);
    store = restoreEntries(store, removed);
    expect(store.entries).toHaveLength(3);
    store = removeEntry(store, "tmdb:2");
    expect(getEntry(store, "tmdb:2")).toBeUndefined();
    // restoring an id that already exists must not duplicate
    store = restoreEntries(store, [store.entries[0]]);
    expect(store.entries.filter((e) => e.id === store.entries[0].id)).toHaveLength(1);
  });
});

describe("views", () => {
  const watched = (id: string, extra: Partial<LibraryEntry>): LibraryEntry => ({
    ...ref(id),
    status: "watched",
    addedAt: "2026-01-01T00:00:00Z",
    ...extra,
  });

  it("derives Watch Again from again=yes|maybe, Favorites from loved, Not for Me from verdict", () => {
    const yes = watched("tmdb:1", { again: "yes" });
    const maybe = watched("tmdb:2", { again: "maybe" });
    const no = watched("tmdb:3", { again: "no" });
    const loved = watched("tmdb:4", { myTake: "loved" });
    const nfm = watched("tmdb:5", { myTake: "not_for_me" });
    const want: LibraryEntry = { ...ref("tmdb:6"), status: "want_to_watch", addedAt: "2026-01-01T00:00:00Z" };

    expect(inView(yes, "watch_again")).toBe(true);
    expect(inView(maybe, "watch_again")).toBe(true);
    expect(inView(no, "watch_again")).toBe(false);
    expect(inView(want, "watch_again")).toBe(false);
    expect(inView(loved, "favorites")).toBe(true);
    expect(inView(nfm, "not_for_me")).toBe(true);
    expect(inView(want, "want_to_watch")).toBe(true);
    expect(inView(yes, "watched")).toBe(true);
    expect(inView(want, "all")).toBe(true);
  });

  it("prob_not is its own status and view, never watched", () => {
    let store = setStatus(emptyStore(), ref("tmdb:9"), "prob_not", "2026-01-05T00:00:00Z");
    const e = getEntry(store, "tmdb:9")!;
    expect(e.status).toBe("prob_not");
    expect(e.watchedAt).toBeUndefined();
    expect(inView(e, "prob_not")).toBe(true);
    expect(inView(e, "want_to_watch")).toBe(false);
    expect(inView(e, "watched")).toBe(false);
    // changing your mind keeps the add date
    store = setStatus(store, ref("tmdb:9"), "watched", "2026-01-06T00:00:00Z");
    expect(getEntry(store, "tmdb:9")?.addedAt).toBe("2026-01-05T00:00:00Z");
    expect(getEntry(store, "tmdb:9")?.watchedAt).toBe("2026-01-06T00:00:00Z");
  });
});

describe("sanitizeStore", () => {
  it("returns empty on garbage", () => {
    expect(sanitizeStore(null).entries).toEqual([]);
    expect(sanitizeStore("junk").entries).toEqual([]);
    expect(sanitizeStore({ entries: "junk" }).entries).toEqual([]);
  });

  it("drops malformed rows and invalid verdicts, keeps valid ones", () => {
    const store = sanitizeStore({
      version: 2,
      entries: [
        { id: "tmdb:1", title: "A", status: "watched", myTake: "loved", again: "yes" },
        { id: "tmdb:2", title: "B", status: "bogus" },
        { id: 3, title: "C", status: "watched" },
        { id: "tmdb:4", title: "D", status: "watched", myTake: "amazing", again: "definitely" },
        null,
      ],
    });
    expect(store.entries.map((e) => e.id)).toEqual(["tmdb:1", "tmdb:4"]);
    expect(store.entries[1].myTake).toBeUndefined();
    expect(store.entries[1].again).toBeUndefined();
  });
});

describe("migrateLegacy", () => {
  it("maps saved→want_to_watch, watched→watched, not-watched→want_to_watch", () => {
    const saved = [
      { id: "tvmaze:526", source: "tvmaze", sourceId: "526", mediaType: "series", title: "The Office", releaseYear: 2005, savedAt: "2026-07-01T00:00:00Z" },
    ];
    const status = [
      { id: "tvmaze:526", source: "tvmaze", sourceId: "526", mediaType: "series", title: "The Office", decision: "watched", decidedAt: "2026-07-02T00:00:00Z" },
      { id: "tvmaze:41821", source: "tvmaze", sourceId: "41821", mediaType: "series", title: "Bluey", decision: "not-watched", decidedAt: "2026-07-03T00:00:00Z" },
    ];
    const store = migrateLegacy(saved, status);
    const office = store.entries.find((e) => e.id === "tvmaze:526");
    const bluey = store.entries.find((e) => e.id === "tvmaze:41821");
    expect(office?.status).toBe("watched");
    expect(office?.watchedAt).toBe("2026-07-02T00:00:00Z");
    expect(office?.addedAt).toBe("2026-07-01T00:00:00Z"); // kept from saved
    expect(bluey?.status).toBe("want_to_watch");
  });

  it("survives garbage input", () => {
    expect(migrateLegacy(null, undefined).entries).toEqual([]);
    expect(migrateLegacy("junk", [{ bad: true }]).entries).toEqual([]);
  });
});
