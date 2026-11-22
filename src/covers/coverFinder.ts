import { albumCount } from "../albums/albumFiles";
import { CollectionStore } from "../albums/albumStore";
import { nextTimestamp } from "../albums/timestamps";
import { CoverQuery, findCover as findCoverOnline } from "../api/coverArt";
import { MusicBrainzError } from "../api/musicBrainz";
import { Album } from "../types";
import { wait } from "../utils/wait";

// MusicBrainz asks for one request a second at most.
export const LOOKUP_EVERY_MS = 1100;
// When MusicBrainz is busy for longer than its own retries cover, it waits
// this long before trying the album again, then longer, and then gives up.
const BUSY_WAITS_MS = [30_000, 60_000, 120_000];
// Covers found are saved together, so the screen and sync don't redo their
// work for each one: once this many are waiting, or this long after the last.
const SAVE_AT = 20;
const SAVE_AFTER_MS = 30_000;

export interface CoverFinderState {
  isFinding: boolean;
  /** Whether it's waiting for MusicBrainz, which is busy. */
  isWaiting: boolean;
  /** Albums looked up so far, in this run or the last, of `total`. */
  done: number;
  total: number;
  /** Covers found so far, in this run or the last. */
  found: number;
}

/** How a run ended: by itself, stopped, or because the network failed. */
export type CoverFinderEnd = "done" | "stopped" | MusicBrainzError["reason"];

export interface CoverFinder {
  getState: () => CoverFinderState;
  subscribe: (listener: () => void) => () => void;
  /**
   * Looks up covers for these albums, after any already waiting. Albums that
   * have a cover by the time their turn comes are skipped.
   */
  find: (ids: string[]) => void;
  /** Stops looking, keeping the covers found. */
  stop: () => void;
  /** Calls the listener each time a run ends. */
  onEnd: (
    listener: (end: CoverFinderEnd, state: CoverFinderState) => void,
  ) => () => void;
}

interface CoverFinderOptions {
  store: CollectionStore;
  findCover?: (
    album: CoverQuery,
    signal: AbortSignal,
  ) => Promise<string | undefined>;
}

/**
 * Looks up covers for albums without one, in the background, one album at a
 * time, and saves them as it goes.
 */
export function createCoverFinder({
  store,
  findCover = findCoverOnline,
}: CoverFinderOptions): CoverFinder {
  let state: CoverFinderState = {
    isFinding: false,
    isWaiting: false,
    done: 0,
    total: 0,
    found: 0,
  };
  const listeners = new Set<() => void>();
  const endListeners = new Set<
    (end: CoverFinderEnd, state: CoverFinderState) => void
  >();
  // The albums waiting, and every album this run has taken on.
  let queue: string[] = [];
  let seen = new Set<string>();
  // Covers found and not saved yet, by album.
  let unsaved = new Map<string, string>();
  let savedAt = 0;
  let lookedUpAt = -Infinity;
  let controller: AbortController | undefined;

  const setState = (change: Partial<CoverFinderState>) => {
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };

  /** Gives the albums found their covers, unless they got one meanwhile. */
  const save = () => {
    savedAt = Date.now();
    if (unsaved.size === 0) {
      return;
    }
    const covers = unsaved;
    unsaved = new Map();
    const changes = (album: Album) => covers.has(album.id) && !album.coverUrl;
    try {
      store.update((current) => {
        if (!current.albums.some(changes)) {
          return current;
        }
        const now = nextTimestamp(current);
        return {
          ...current,
          albums: current.albums.map((album) =>
            changes(album)
              ? { ...album, coverUrl: covers.get(album.id), updatedAt: now }
              : album,
          ),
        };
      });
    } catch {
      // The browser's storage is full, so these covers can't be kept.
    }
  };

  const end = (how: CoverFinderEnd) => {
    controller = undefined;
    queue = [];
    seen = new Set();
    save();
    setState({ isFinding: false, isWaiting: false });
    endListeners.forEach((listener) => listener(how, state));
  };

  const run = async (signal: AbortSignal) => {
    // Busy answers in a row, which only a lookup that works resets.
    let busy = 0;
    // Stopping ends the run itself, so this one leaves everything alone once
    // it's stopped: a new run may have started by then.
    while (!signal.aborted && queue.length > 0) {
      const id = queue.shift()!;
      const album = store.get().albums.find((album) => album.id === id);
      if (album && !album.coverUrl) {
        let coverUrl: string | undefined;
        try {
          const delay = lookedUpAt + LOOKUP_EVERY_MS - Date.now();
          if (delay > 0) {
            await wait(delay, signal);
          }
          lookedUpAt = Date.now();
          const { title, artist, year } = album;
          coverUrl = await findCover({ title, artist, year }, signal);
          busy = 0;
        } catch (error) {
          if (signal.aborted) {
            return;
          }
          const reason =
            error instanceof MusicBrainzError ? error.reason : "unavailable";
          if (reason === "unavailable" && busy < BUSY_WAITS_MS.length) {
            setState({ isWaiting: true });
            try {
              await wait(BUSY_WAITS_MS[busy++], signal);
            } catch {
              return;
            }
            setState({ isWaiting: false });
            queue.unshift(id);
            continue;
          }
          end(reason);
          return;
        }
        if (signal.aborted) {
          return;
        }
        if (coverUrl) {
          unsaved.set(id, coverUrl);
          setState({ found: state.found + 1 });
        }
      }
      setState({ done: state.done + 1 });
      if (
        unsaved.size >= SAVE_AT ||
        (unsaved.size > 0 && Date.now() - savedAt >= SAVE_AFTER_MS)
      ) {
        save();
      }
    }
    if (!signal.aborted) {
      end("done");
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onEnd(listener) {
      endListeners.add(listener);
      return () => endListeners.delete(listener);
    },
    find(ids) {
      const added = [...new Set(ids)].filter((id) => !seen.has(id));
      if (added.length === 0) {
        return;
      }
      added.forEach((id) => seen.add(id));
      queue.push(...added);
      if (controller) {
        setState({ total: state.total + added.length });
        return;
      }
      controller = new AbortController();
      savedAt = Date.now();
      setState({
        isFinding: true,
        isWaiting: false,
        done: 0,
        total: added.length,
        found: 0,
      });
      void run(controller.signal);
    },
    stop() {
      controller?.abort();
      if (controller) {
        end("stopped");
      }
    },
  };
}

/** Says how a run of the cover finder ended. */
export function describeCoverSearch(
  end: CoverFinderEnd,
  { found, total }: CoverFinderState,
) {
  const carryOn = "Find missing covers, in the ⋯ menu, carries on later.";
  if (end === "offline") {
    return `Stopped finding covers, as the browser is offline. ${carryOn}`;
  }
  if (end === "unavailable") {
    return `Stopped finding covers, as MusicBrainz isn't answering. ${carryOn}`;
  }
  if (end === "stopped") {
    return found === 0
      ? "Stopped finding covers."
      : `Stopped finding covers, after finding ${found}.`;
  }
  if (found === 0) {
    return total === 1
      ? "Couldn't find a cover for the album."
      : `Couldn't find covers for the ${albumCount(total)}.`;
  }
  if (found === total) {
    return total === 1
      ? "Found the album's cover."
      : `Found covers for all ${albumCount(total)}.`;
  }
  return `Found covers for ${found.toLocaleString()} of ${albumCount(total)}.`;
}
