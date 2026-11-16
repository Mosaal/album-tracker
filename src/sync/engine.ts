import { CollectionStore } from "../albumStore";
import { createGitHubClient, GitHubClient, GitHubError } from "../api/github";
import { Collection } from "../types";
import {
  clearConfig,
  CONFIG_KEY,
  readConfig,
  saveConfig,
  SyncConfig,
} from "./config";
import { mergeCollections } from "./merge";
import {
  createSyncFile,
  describeChanges,
  InvalidSyncFileError,
  NewerSyncFileError,
  readSyncFile,
  SYNC_FILE_NAME,
  UnreadableEntriesError,
} from "./syncFile";

/** How long to wait after a change, so a burst of changes makes one commit. */
const CHANGE_DELAY_MS = 2000;
/** How often coming back to the app checks for other devices' changes. */
const REVISIT_INTERVAL_MS = 30_000;
/** Waits before trying again when another device saved at the same moment. */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export type SyncStatus =
  | "disconnected"
  | "syncing"
  | "synced"
  /** Changes on this device are waiting to be sent. */
  | "pending"
  | "offline"
  | "error";

export interface SyncState {
  status: SyncStatus;
  /** The repository, while connected. */
  repo?: string;
  /** When this device last finished syncing. */
  syncedAt?: Date;
  /** What went wrong, for the "error" status. */
  error?: string;
}

/** A repository checked before connecting to it. */
export interface CheckedRepo {
  /** "owner/name", as GitHub spells it. */
  repo: string;
  isPrivate: boolean;
  /** The collection in it, if it has one yet. */
  collection?: Collection;
}

export interface SyncEngine {
  getState: () => SyncState;
  /** The repository and token, while connected. */
  getConfig: () => SyncConfig | undefined;
  subscribe: (listener: () => void) => () => void;
  /** Syncs now, and whenever it's needed until the returned function is called. */
  start: () => () => void;
  /** Checks that the token opens the repository, and reads its collection. */
  check: (config: SyncConfig) => Promise<CheckedRepo>;
  /**
   * Starts syncing with a checked repository. The collection in it replaces
   * this device's; if it has none yet, this device's albums start it.
   */
  connect: (checked: CheckedRepo, token: string) => Promise<void>;
  /** Checks the new token opens the repository, then syncs with it. */
  changeToken: (token: string) => Promise<void>;
  /** Stops syncing. The albums on this device and on GitHub stay as they are. */
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

interface SyncEngineOptions {
  store: CollectionStore;
  storage?: Storage;
  createClient?: (token: string) => GitHubClient;
}

const timeOfDay = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** What went wrong while connecting or syncing, for people. */
export function describeSyncError(error: unknown, repo: string) {
  if (error instanceof InvalidSyncFileError) {
    return `${SYNC_FILE_NAME} in ${repo} isn't from Album Tracker, so it was left alone.`;
  }
  if (error instanceof UnreadableEntriesError) {
    return error.count === 1
      ? `${SYNC_FILE_NAME} in ${repo} has an entry Album Tracker can't read, so it was left alone. Fix the entry on GitHub to carry on syncing.`
      : `${SYNC_FILE_NAME} in ${repo} has ${error.count} entries Album Tracker can't read, so it was left alone. Fix them on GitHub to carry on syncing.`;
  }
  if (error instanceof NewerSyncFileError) {
    return `${SYNC_FILE_NAME} in ${repo} was saved by a newer version of Album Tracker. Reload the app to update it.`;
  }
  if (!(error instanceof GitHubError)) {
    return "Something went wrong while syncing.";
  }
  switch (error.reason) {
    case "offline":
      return "Couldn't reach GitHub. Check your connection.";
    case "unauthorized":
      return "GitHub didn't accept the token. It may have expired or been deleted.";
    case "forbidden":
      return `The token can't save to ${repo}. Give it read and write access to Contents.`;
    case "not-found":
      return `Couldn't find ${repo}, or the token can't open it.`;
    case "rate-limited":
      return error.retryAt
        ? `GitHub's rate limit was reached. Syncing can resume at ${timeOfDay(error.retryAt)}.`
        : "GitHub's rate limit was reached. Try again later.";
    case "conflict":
      return "Another device kept saving at the same time. Try again in a moment.";
    case "unavailable":
      return "GitHub isn't working properly right now. Try again later.";
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Two open tabs would otherwise sync at the same time, and make a commit each.
const oneTabAtATime = (task: () => Promise<void>) =>
  "locks" in navigator
    ? navigator.locks.request("album-tracker:sync", task)
    : task();

/**
 * Keeps the collection in step with albums.json in a GitHub repository:
 * downloads it, merges it into this device's collection, and uploads the
 * result if that differs. Syncs on launch, shortly after changes, when the
 * app comes back into view, and when the connection returns.
 */
export function createSyncEngine({
  store,
  storage = localStorage,
  createClient = createGitHubClient,
}: SyncEngineOptions): SyncEngine {
  let config = readConfig(storage);
  let state: SyncState = config
    ? { status: "syncing", repo: config.repo }
    : { status: "disconnected" };
  // The collection the repository is known to have, as file text.
  let lastSynced: string | undefined;
  let running: Promise<void> | undefined;
  let queued: Promise<void> | undefined;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRoundAt = -Infinity;
  // Set while the engine merges into the store, which isn't a change to send.
  let isMerging = false;
  const listeners = new Set<() => void>();

  const setState = (next: SyncState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const hasChanges = () => createSyncFile(store.get()) !== lastSynced;

  function mergeIntoStore(remote: Collection) {
    isMerging = true;
    try {
      store.update((local) => {
        const merged = mergeCollections(local, remote);
        return createSyncFile(merged) === createSyncFile(local)
          ? local
          : merged;
      });
    } finally {
      isMerging = false;
    }
  }

  async function sync(current: SyncConfig) {
    const client = createClient(current.token);
    for (const retryDelay of [...RETRY_DELAYS_MS, undefined]) {
      const file = await client.getFile(current.repo, SYNC_FILE_NAME);
      if (config !== current) {
        return;
      }
      const remote = file && readSyncFile(file.text);
      if (remote) {
        mergeIntoStore(remote);
      }
      const local = store.get();
      const text = createSyncFile(local);
      // Compared with the file as it is, so that tidying it up, such as giving
      // ids to albums added on GitHub, is saved too.
      if (file && text === file.text) {
        lastSynced = text;
        return;
      }
      try {
        await client.putFile(current.repo, SYNC_FILE_NAME, {
          text,
          sha: file?.sha,
          message: describeChanges(remote, local),
        });
        lastSynced = text;
        return;
      } catch (error) {
        const isConflict =
          error instanceof GitHubError && error.reason === "conflict";
        if (!isConflict || retryDelay === undefined) {
          throw error;
        }
      }
      // Another device saved in between: start over from its version.
      await wait(retryDelay);
      if (config !== current) {
        return;
      }
    }
  }

  async function runRound() {
    const current = config;
    if (!current) {
      return;
    }
    lastRoundAt = Date.now();
    setState({ ...state, status: "syncing", error: undefined });
    try {
      await oneTabAtATime(() => sync(current));
      if (config === current) {
        setState({
          status: hasChanges() ? "pending" : "synced",
          repo: current.repo,
          syncedAt: new Date(),
        });
      }
    } catch (error) {
      if (config !== current) {
        return;
      }
      const isExpected =
        error instanceof GitHubError ||
        error instanceof InvalidSyncFileError ||
        error instanceof NewerSyncFileError ||
        error instanceof UnreadableEntriesError;
      if (!isExpected) {
        console.error(error);
      }
      const isOffline =
        error instanceof GitHubError && error.reason === "offline";
      setState({
        status: isOffline ? "offline" : "error",
        repo: current.repo,
        syncedAt: state.syncedAt,
        error: isOffline ? undefined : describeSyncError(error, current.repo),
      });
    }
  }

  /** Runs one round at a time, and at most one more after it. */
  function requestRound(): Promise<void> {
    clearTimeout(changeTimer);
    if (!config) {
      return Promise.resolve();
    }
    if (!running) {
      running = runRound().finally(() => {
        running = undefined;
      });
      return running;
    }
    queued ??= running.then(() => {
      queued = undefined;
      return requestRound();
    });
    return queued;
  }

  const onStoreChange = () => {
    if (isMerging || !config) {
      return;
    }
    const changed = hasChanges();
    if (state.status === "synced" || state.status === "pending") {
      const status = changed ? "pending" : "synced";
      if (state.status !== status) {
        setState({ ...state, status });
      }
    }
    clearTimeout(changeTimer);
    if (changed) {
      changeTimer = setTimeout(requestRound, CHANGE_DELAY_MS);
    }
  };

  const revisit = () => {
    if (Date.now() - lastRoundAt >= REVISIT_INTERVAL_MS) {
      void requestRound();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      revisit();
    } else if (config && hasChanges()) {
      // The browser may stop the app soon after it's put away.
      void requestRound();
    }
  };

  const onOnline = () => void requestRound();

  // Another tab connected, changed the token or disconnected.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CONFIG_KEY && event.key !== null) {
      return;
    }
    const next = readConfig(storage);
    if (next?.repo === config?.repo && next?.token === config?.token) {
      return;
    }
    config = next;
    lastSynced = undefined;
    if (next) {
      setState({ status: "syncing", repo: next.repo });
      void requestRound();
    } else {
      clearTimeout(changeTimer);
      setState({ status: "disconnected" });
    }
  };

  return {
    getState: () => state,

    getConfig: () => config,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    start() {
      const unsubscribe = store.subscribe(onStoreChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", revisit);
      window.addEventListener("online", onOnline);
      window.addEventListener("storage", onStorage);
      void requestRound();
      return () => {
        unsubscribe();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", revisit);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("storage", onStorage);
        clearTimeout(changeTimer);
      };
    },

    async check({ repo, token }) {
      const client = createClient(token);
      const found = await client.getRepo(repo);
      const file = await client.getFile(found.fullName, SYNC_FILE_NAME);
      return {
        repo: found.fullName,
        isPrivate: found.isPrivate,
        collection: file && readSyncFile(file.text),
      };
    },

    async connect({ repo, collection }, token) {
      if (collection) {
        isMerging = true;
        try {
          store.update(() => collection);
        } finally {
          isMerging = false;
        }
        lastSynced = createSyncFile(collection);
      } else {
        const local = store.get();
        const text = createSyncFile(local);
        await createClient(token).putFile(repo, SYNC_FILE_NAME, {
          text,
          message: describeChanges(undefined, local),
        });
        lastSynced = text;
      }
      config = { repo, token };
      saveConfig(storage, config);
      setState({
        status: hasChanges() ? "pending" : "synced",
        repo,
        syncedAt: new Date(),
      });
      // Catch up with anything saved since the check, or changed meanwhile.
      if (collection || hasChanges()) {
        await requestRound();
      }
    },

    async changeToken(token) {
      const current = config;
      if (!current) {
        return;
      }
      await createClient(token).getRepo(current.repo);
      if (config !== current) {
        return;
      }
      config = { repo: current.repo, token };
      saveConfig(storage, config);
      await requestRound();
    },

    disconnect() {
      config = undefined;
      lastSynced = undefined;
      clearTimeout(changeTimer);
      clearConfig(storage);
      setState({ status: "disconnected" });
    },

    syncNow: requestRound,
  };
}
