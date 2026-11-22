import { useCallback, useSyncExternalStore } from "react";

import { mergeAlbums } from "../albums/albumFiles";
import { CollectionStore } from "../albums/albumStore";
import { nextTimestamp } from "../albums/timestamps";
import {
  Album,
  AlbumFormat,
  AlbumInput,
  Collection,
  DeletedAlbum,
} from "../types";

const sameDetails = (album: Album, input: AlbumInput) =>
  album.title === input.title &&
  album.artist === input.artist &&
  album.year === input.year &&
  album.coverUrl === input.coverUrl &&
  album.format === input.format &&
  album.status === input.status &&
  album.notes === input.notes;

/**
 * Gives the albums with these ids the same status or format. Only the ones
 * that change get a new updatedAt.
 */
const setField =
  <Key extends "status" | "format">(
    ids: string[],
    key: Key,
    value: Album[Key],
  ) =>
  (current: Collection): Collection => {
    const changes = (album: Album) =>
      ids.includes(album.id) && album[key] !== value;
    if (!current.albums.some(changes)) {
      return current;
    }
    const now = nextTimestamp(current);
    return {
      ...current,
      albums: current.albums.map((album) =>
        changes(album) ? { ...album, [key]: value, updatedAt: now } : album,
      ),
    };
  };

/** Drops the deletion records of albums that are back in the collection. */
const forgetDeleted = (deleted: DeletedAlbum[], ids: string[]) =>
  deleted.some(({ id }) => ids.includes(id))
    ? deleted.filter(({ id }) => !ids.includes(id))
    : deleted;

/**
 * The album collection, and the ways to change it. Each change records when
 * it happened, and deleted albums are remembered.
 */
export function useAlbums(store: CollectionStore) {
  const { albums } = useSyncExternalStore(store.subscribe, store.get);

  const addAlbum = useCallback(
    (input: AlbumInput) => {
      store.update((current) => {
        const now = nextTimestamp(current);
        const album: Album = {
          ...input,
          id: crypto.randomUUID(),
          addedAt: now,
          updatedAt: now,
        };
        return { ...current, albums: [...current.albums, album] };
      });
    },
    [store],
  );

  const updateAlbum = useCallback(
    (id: string, input: AlbumInput) => {
      store.update((current) => {
        const album = current.albums.find((album) => album.id === id);
        if (!album || sameDetails(album, input)) {
          return current;
        }
        const updated: Album = {
          ...input,
          id,
          ...(album.addedAt ? { addedAt: album.addedAt } : {}),
          updatedAt: nextTimestamp(current),
        };
        return {
          ...current,
          albums: current.albums.map((album) =>
            album.id === id ? updated : album,
          ),
        };
      });
    },
    [store],
  );

  const setAlbumsStatus = useCallback(
    (ids: string[], status: Album["status"]) =>
      store.update(setField(ids, "status", status)),
    [store],
  );

  const setAlbumsFormat = useCallback(
    (ids: string[], format: AlbumFormat) =>
      store.update(setField(ids, "format", format)),
    [store],
  );

  /**
   * Removes albums, returning a function that puts them back where they were,
   * which matters for albums older than the dates that sort Recently added.
   */
  const deleteAlbums = useCallback(
    (ids: string[]) => {
      const removed = store
        .get()
        .albums.flatMap((album, index) =>
          ids.includes(album.id) ? [{ album, index }] : [],
        );
      if (removed.length === 0) {
        return () => {};
      }
      store.update((current) => {
        const now = nextTimestamp(current);
        return {
          albums: current.albums.filter((album) => !ids.includes(album.id)),
          deleted: [
            ...forgetDeleted(current.deleted, ids),
            ...removed.map(({ album }) => ({ id: album.id, deletedAt: now })),
          ],
        };
      });
      return () =>
        store.update((current) => {
          const missing = removed.filter(
            ({ album }) => !current.albums.some(({ id }) => id === album.id),
          );
          if (missing.length === 0) {
            return current;
          }
          const now = nextTimestamp(current);
          const albums = [...current.albums];
          // In their original order, so each index counts the ones before it.
          for (const { album, index } of missing) {
            albums.splice(index, 0, { ...album, updatedAt: now });
          }
          return {
            albums,
            deleted: forgetDeleted(
              current.deleted,
              missing.map(({ album }) => album.id),
            ),
          };
        });
    },
    [store],
  );

  /** Adds albums from an imported file, skipping any already in the collection. */
  const importAlbums = useCallback(
    (imported: Album[]) => {
      let summary = { added: 0, skipped: 0 };
      store.update((current) => {
        const { albums, added, skipped } = mergeAlbums(
          current.albums,
          imported,
        );
        summary = { added, skipped };
        if (added === 0) {
          return current;
        }
        const now = nextTimestamp(current);
        const newAlbums = albums.slice(current.albums.length).map((album) => ({
          ...album,
          addedAt: album.addedAt ?? now,
          updatedAt: now,
        }));
        return {
          albums: [...current.albums, ...newAlbums],
          deleted: forgetDeleted(
            current.deleted,
            newAlbums.map(({ id }) => id),
          ),
        };
      });
      return summary;
    },
    [store],
  );

  /**
   * Adds albums found in a music folder as owned, in the format chosen, and
   * marks the wishlisted ones found there as owned, in that format if they
   * had none. Albums already in the collection by then are skipped.
   */
  const importMusicFolder = useCallback(
    (
      found: Pick<AlbumInput, "title" | "artist" | "year" | "coverUrl">[],
      wishlistedIds: string[],
      format: AlbumFormat,
    ) => {
      let summary = { added: 0, markedOwned: 0, skipped: 0 };
      const toMarkOwned = new Set(wishlistedIds);
      store.update((current) => {
        const now = nextTimestamp(current);
        let markedOwned = 0;
        const withOwned = current.albums.map((album) => {
          if (album.status !== "wishlisted" || !toMarkOwned.has(album.id)) {
            return album;
          }
          markedOwned += 1;
          return {
            ...album,
            status: "owned" as const,
            format: album.format ?? format,
            updatedAt: now,
          };
        });
        const { albums, added, skipped } = mergeAlbums(
          withOwned,
          found.map(({ title, artist, year, coverUrl }) => ({
            id: crypto.randomUUID(),
            title,
            artist,
            ...(year !== undefined && { year }),
            ...(coverUrl && { coverUrl }),
            format,
            status: "owned" as const,
            addedAt: now,
            updatedAt: now,
          })),
        );
        summary = { added, markedOwned, skipped };
        return added === 0 && markedOwned === 0
          ? current
          : { ...current, albums };
      });
      return summary;
    },
    [store],
  );

  return {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumsStatus,
    setAlbumsFormat,
    deleteAlbums,
    importAlbums,
    importMusicFolder,
  };
}
