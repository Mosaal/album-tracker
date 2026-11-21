import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCollectionStore } from "../albums/albumStore";
import { GitHubError } from "../api/github";
import { createFakeGitHub, createMemoryStorage } from "../test/fakeGitHub";
import { Album, Collection } from "../types";
import { CONFIG_KEY, saveConfig } from "./config";
import { createSyncEngine } from "./engine";
import { createSyncFile, readSyncFile } from "./syncFile";

const BLUE_LINES: Album = {
  id: "1",
  title: "Blue Lines",
  artist: "Massive Attack",
  status: "owned",
};
const PROTECTION: Album = {
  id: "2",
  title: "Protection",
  artist: "Massive Attack",
  status: "wishlisted",
};
const MEZZANINE: Album = {
  id: "3",
  title: "Mezzanine",
  artist: "Massive Attack",
  status: "owned",
};

let github: ReturnType<typeof createFakeGitHub>;
const stops: (() => void)[] = [];

/** A device with its own storage, and these albums on it. */
function createDevice(albums: Album[] = [], { connected = false } = {}) {
  const storage = createMemoryStorage();
  storage.setItem("album-tracker:albums", JSON.stringify(albums));
  if (connected) {
    saveConfig(storage, { repo: github.repo, token: github.token });
  }
  const store = createCollectionStore(storage);
  const engine = createSyncEngine({ store, storage });
  const titles = () => store.get().albums.map((album) => album.title);
  const add = (album: Album) =>
    store.update((current) => ({
      ...current,
      albums: [...current.albums, album],
    }));
  const start = () => {
    stops.push(engine.start());
  };
  const connect = async () => {
    const checked = await engine.check({
      repo: github.repo,
      token: github.token,
    });
    await engine.connect(checked, github.token);
  };
  return { storage, store, engine, titles, add, start, connect };
}

const onGitHub = () => readSyncFile(github.text!);
const titlesOf = ({ albums }: Collection) => albums.map((album) => album.title);
const messages = () => github.commits.map((commit) => commit.message);

describe("syncing with GitHub", () => {
  beforeEach(() => {
    github = createFakeGitHub();
    vi.stubGlobal("fetch", github.fetch);
    vi.useFakeTimers({
      now: new Date("2026-03-01T10:00:00Z"),
      toFake: ["setTimeout", "clearTimeout", "Date"],
    });
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts the collection on GitHub with the first device's albums", async () => {
    const laptop = createDevice([BLUE_LINES, PROTECTION]);

    const checked = await laptop.engine.check({
      repo: "mosaal/album-collection",
      token: github.token,
    });
    expect(checked).toEqual({
      repo: "Mosaal/album-collection",
      isPrivate: true,
    });
    await laptop.engine.connect(checked, github.token);

    expect(messages()).toEqual(["Start syncing 2 albums"]);
    expect(github.text).toBe(createSyncFile(laptop.store.get()));
    expect(laptop.engine.getState()).toMatchObject({
      status: "synced",
      repo: "Mosaal/album-collection",
    });
    expect(JSON.parse(laptop.storage.getItem(CONFIG_KEY)!)).toEqual({
      repo: "Mosaal/album-collection",
      token: github.token,
    });
  });

  it("replaces a newly connected device's albums with the ones on GitHub", async () => {
    await createDevice([BLUE_LINES, PROTECTION]).connect();
    const phone = createDevice([MEZZANINE]);

    await phone.connect();

    expect(phone.titles()).toEqual(["Blue Lines", "Protection"]);
    expect(messages()).toEqual(["Start syncing 2 albums"]);
  });

  it("sends changes shortly after they're made, in one commit", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    laptop.start();
    await vi.runOnlyPendingTimersAsync();

    laptop.add(PROTECTION);
    laptop.add(MEZZANINE);
    expect(laptop.engine.getState().status).toBe("pending");
    await vi.advanceTimersByTimeAsync(2000);

    expect(messages()).toEqual(["Start syncing 1 album", "Add 2 albums"]);
    expect(titlesOf(onGitHub())).toEqual([
      "Blue Lines",
      "Protection",
      "Mezzanine",
    ]);
    expect(laptop.engine.getState().status).toBe("synced");
  });

  it("brings in other devices' changes, deletions included", async () => {
    const laptop = createDevice([BLUE_LINES, PROTECTION]);
    await laptop.connect();
    const phone = createDevice();
    await phone.connect();

    laptop.store.update(() => ({
      albums: [BLUE_LINES, MEZZANINE],
      deleted: [{ id: "2", deletedAt: "2026-03-01T10:00:00.000Z" }],
    }));
    await laptop.engine.syncNow();
    await phone.engine.syncNow();

    expect(phone.titles()).toEqual(["Blue Lines", "Mezzanine"]);
    expect(phone.store.get().deleted).toEqual([
      { id: "2", deletedAt: "2026-03-01T10:00:00.000Z" },
    ]);
  });

  it("merges with a save another device made at the same moment", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    const phone = createDevice();
    await phone.connect();
    laptop.add(PROTECTION);
    phone.add(MEZZANINE);

    // The phone saves while the laptop is sending its own change.
    github.beforeNextSave = () => phone.engine.syncNow();
    const saving = laptop.engine.syncNow();
    await vi.advanceTimersByTimeAsync(1000);
    await saving;

    expect(messages()).toEqual([
      "Start syncing 1 album",
      'Add "Mezzanine" by Massive Attack',
      'Add "Protection" by Massive Attack',
    ]);
    expect(titlesOf(onGitHub())).toEqual([
      "Blue Lines",
      "Mezzanine",
      "Protection",
    ]);
    expect(laptop.titles()).toEqual(["Blue Lines", "Mezzanine", "Protection"]);
  });

  it("makes no commit when there's nothing new", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();

    await laptop.engine.syncNow();
    await laptop.engine.syncNow();

    expect(github.commits).toHaveLength(1);
  });

  it("keeps changes made during a sync for the next one", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    laptop.start();
    await vi.runOnlyPendingTimersAsync();

    github.beforeNextSave = () => laptop.add(MEZZANINE);
    laptop.add(PROTECTION);
    await vi.advanceTimersByTimeAsync(2000);
    expect(laptop.engine.getState().status).toBe("pending");
    await vi.advanceTimersByTimeAsync(2000);

    expect(messages().slice(1)).toEqual([
      'Add "Protection" by Massive Attack',
      'Add "Mezzanine" by Massive Attack',
    ]);
    expect(laptop.engine.getState().status).toBe("synced");
  });

  it.each([
    [
      "isn't from Album Tracker",
      "# My albums\n",
      "albums.json in Mosaal/album-collection isn't from Album Tracker, so it was left alone.",
    ],
    [
      "has an album it can't read",
      JSON.stringify({
        format: "album-tracker",
        version: 1,
        albums: [{ ...MEZZANINE, status: "Owned" }],
      }),
      "albums.json in Mosaal/album-collection has an entry Album Tracker can't read, so it was left alone. Fix the entry on GitHub to carry on syncing.",
    ],
  ])("leaves a file that %s alone", async (_, text, error) => {
    github.save(text);
    const laptop = createDevice([BLUE_LINES], { connected: true });

    laptop.start();
    await vi.runOnlyPendingTimersAsync();

    expect(laptop.engine.getState()).toMatchObject({ status: "error", error });
    expect(github.commits).toHaveLength(1);
  });

  it("agrees on an id for an album added on GitHub without one, and saves it there", async () => {
    const { id: _, ...withoutId } = MEZZANINE;
    github.save(
      JSON.stringify({
        format: "album-tracker",
        version: 1,
        albums: [BLUE_LINES, withoutId],
      }),
    );
    // The phone reads the file before the laptop saves the ids.
    const phone = createDevice();
    const checked = await phone.engine.check({
      repo: github.repo,
      token: github.token,
    });
    const laptop = createDevice();
    await laptop.connect();
    await phone.engine.connect(checked, github.token);
    await laptop.engine.syncNow();
    await phone.engine.syncNow();

    const ids = laptop.store.get().albums.map((album) => album.id);
    expect(ids).toHaveLength(2);
    expect(phone.store.get().albums.map((album) => album.id)).toEqual(ids);
    expect(onGitHub().albums.map((album) => album.id)).toEqual(ids);
    expect(messages()).toEqual(["Edit albums.json", "Update albums"]);
  });

  it("waits while offline, and syncs when the connection returns", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    laptop.start();
    await vi.runOnlyPendingTimersAsync();

    github.online = false;
    laptop.add(PROTECTION);
    await vi.advanceTimersByTimeAsync(2000);
    expect(laptop.engine.getState().status).toBe("offline");

    github.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.runOnlyPendingTimersAsync();

    expect(laptop.engine.getState().status).toBe("synced");
    expect(titlesOf(onGitHub())).toEqual(["Blue Lines", "Protection"]);
  });

  it("explains when GitHub stops accepting the token, and takes a new one", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    const oldToken = github.token;
    github.token = "github_pat_new";

    await laptop.engine.syncNow();
    expect(laptop.engine.getState()).toMatchObject({
      status: "error",
      error:
        "GitHub didn't accept the token. It may have expired or been deleted.",
    });

    await expect(laptop.engine.changeToken("github_pat_wrong")).rejects.toThrow(
      GitHubError,
    );
    await laptop.engine.changeToken("github_pat_new");

    expect(laptop.engine.getState().status).toBe("synced");
    expect(laptop.storage.getItem(CONFIG_KEY)).not.toContain(oldToken);
  });

  it("stops syncing on disconnect, keeping the albums", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();
    laptop.start();
    await vi.runOnlyPendingTimersAsync();

    laptop.engine.disconnect();
    laptop.add(PROTECTION);
    await vi.advanceTimersByTimeAsync(2000);

    expect(laptop.engine.getState()).toEqual({ status: "disconnected" });
    expect(laptop.storage.getItem(CONFIG_KEY)).toBeNull();
    expect(laptop.titles()).toEqual(["Blue Lines", "Protection"]);
    expect(github.commits).toHaveLength(1);
  });

  it("retries a busy GitHub on the next change, and says what went wrong meanwhile", async () => {
    const laptop = createDevice([BLUE_LINES]);
    await laptop.connect();

    github.failNextWith = 503;
    await laptop.engine.syncNow();
    expect(laptop.engine.getState()).toMatchObject({
      status: "error",
      error: "GitHub isn't working properly right now. Try again later.",
    });

    await laptop.engine.syncNow();
    expect(laptop.engine.getState().status).toBe("synced");
  });
});
