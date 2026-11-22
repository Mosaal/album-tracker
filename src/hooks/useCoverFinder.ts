import { useEffect, useState } from "react";

import { CollectionStore } from "../albums/albumStore";
import { createCoverFinder } from "../covers/coverFinder";

/**
 * The cover finder, created once. Its state isn't read here, so its progress
 * only renders what shows it, rather than the whole screen.
 */
export function useCoverFinder(store: CollectionStore) {
  const [finder] = useState(() => createCoverFinder({ store }));
  // Stops looking when the app closes, keeping the covers found.
  useEffect(() => () => finder.stop(), [finder]);
  return finder;
}
