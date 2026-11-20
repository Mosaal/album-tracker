import { isRecord } from "../albums/albumFiles";

export const CONFIG_KEY = "album-tracker:github-sync";

/** The repository this device syncs with, and the token that opens it. */
export interface SyncConfig {
  /** "owner/name". */
  repo: string;
  token: string;
}

export function readConfig(storage: Storage): SyncConfig | undefined {
  try {
    const data: unknown = JSON.parse(storage.getItem(CONFIG_KEY) ?? "null");
    return isRecord(data) &&
      typeof data.repo === "string" &&
      typeof data.token === "string"
      ? { repo: data.repo, token: data.token }
      : undefined;
  } catch {
    return undefined;
  }
}

export const saveConfig = (storage: Storage, config: SyncConfig) =>
  storage.setItem(CONFIG_KEY, JSON.stringify(config));

export const clearConfig = (storage: Storage) => storage.removeItem(CONFIG_KEY);
