import { useEffect, useState, useSyncExternalStore } from "react";

import { CollectionStore } from "../albumStore";
import { createSyncEngine } from "../sync/engine";

/**
 * Syncs the collection with a GitHub repository, once connected. Returns the
 * engine, to connect and disconnect, and its state.
 */
export function useGitHubSync(store: CollectionStore) {
  const [engine] = useState(() => createSyncEngine({ store }));
  useEffect(() => engine.start(), [engine]);
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  return { engine, state };
}
