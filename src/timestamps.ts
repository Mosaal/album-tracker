import { Collection } from "./types";

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** An ISO date and time read from a file, written the way the app writes them. */
export function toTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    return undefined;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** A timestamp in milliseconds. A missing one is older than any other. */
export function timeOf(timestamp: string | undefined) {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  return Number.isNaN(time) ? -Infinity : time;
}

/**
 * The time to record a change at: now, or just after the newest time already
 * in the collection if that's later. So a device whose clock runs behind
 * can't make its new changes look older than ones it already has.
 */
export function nextTimestamp(collection: Collection, now = Date.now()) {
  let latest = -Infinity;
  for (const album of collection.albums) {
    latest = Math.max(latest, timeOf(album.addedAt), timeOf(album.updatedAt));
  }
  for (const { deletedAt } of collection.deleted) {
    latest = Math.max(latest, timeOf(deletedAt));
  }
  return new Date(Math.max(now, latest + 1)).toISOString();
}
