import { SyncState } from "./engine";

/** The time, with the date too unless it was today. */
export function formatSyncTime(date: Date) {
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** How syncing is going, in a sentence. */
export function describeSyncStatus({ status, syncedAt, error }: SyncState) {
  switch (status) {
    case "disconnected":
      return "Not syncing";
    case "syncing":
      return "Syncing…";
    case "synced":
      return syncedAt ? `Synced at ${formatSyncTime(syncedAt)}` : "Synced";
    case "pending":
      return "Changes waiting to sync";
    case "offline":
      return "Offline. Changes will sync when you're back online.";
    case "error":
      return error ?? "Couldn't sync.";
  }
}
