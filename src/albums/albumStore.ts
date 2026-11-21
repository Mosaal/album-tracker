import { Collection } from "../types";

const ALBUMS_KEY = "album-tracker:albums";
const DELETED_KEY = "album-tracker:deleted";

/** A saved list, or an empty one if it's missing or unreadable. */
function readList<T>(storage: Storage, key: string): T[] {
  try {
    const stored: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export interface CollectionStore {
  /** The collection now. It's a new object after every change. */
  get: () => Collection;
  /** Calls the listener after every change, including other tabs' changes. */
  subscribe: (listener: () => void) => () => void;
  /** Saves what the change returns, unless it returns the current collection. */
  update: (change: (current: Collection) => Collection) => void;
}

/**
 * The collection, saved in this browser's storage. Changes saved by another
 * tab show up here as they happen, so open tabs can't overwrite each other.
 */
export function createCollectionStore(
  storage: Storage = localStorage,
): CollectionStore {
  const read = (): Collection => ({
    albums: readList(storage, ALBUMS_KEY),
    deleted: readList(storage, DELETED_KEY),
  });
  let collection = read();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const reloadAfterOtherTab = (event: StorageEvent) => {
    // A null key means another tab cleared the storage.
    if ([ALBUMS_KEY, DELETED_KEY, null].includes(event.key)) {
      collection = read();
      notify();
    }
  };

  return {
    get: () => collection,
    subscribe(listener) {
      if (listeners.size === 0) {
        window.addEventListener("storage", reloadAfterOtherTab);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("storage", reloadAfterOtherTab);
        }
      };
    },
    update(change) {
      const next = change(collection);
      if (next === collection) {
        return;
      }
      if (next.albums !== collection.albums) {
        storage.setItem(ALBUMS_KEY, JSON.stringify(next.albums));
      }
      if (next.deleted !== collection.deleted) {
        storage.setItem(DELETED_KEY, JSON.stringify(next.deleted));
      }
      collection = next;
      notify();
    },
  };
}
