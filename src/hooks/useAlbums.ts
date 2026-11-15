import { useCallback, useEffect, useState } from "react";

import { mergeAlbums } from "../albumFiles";
import { Album, AlbumInput } from "../types";

const STORAGE_KEY = "album-tracker:albums";

function readStoredAlbums(): Album[] {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/** The album collection, saved in this browser's localStorage. */
export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>(readStoredAlbums);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
  }, [albums]);

  const addAlbum = useCallback((input: AlbumInput) => {
    const album: Album = { ...input, id: crypto.randomUUID() };
    setAlbums((current) => [...current, album]);
  }, []);

  const updateAlbum = useCallback((id: string, input: AlbumInput) => {
    setAlbums((current) =>
      current.map((album) => (album.id === id ? { ...input, id } : album)),
    );
  }, []);

  const setAlbumsStatus = useCallback(
    (ids: string[], status: Album["status"]) => {
      setAlbums((current) =>
        current.map((album) =>
          ids.includes(album.id) ? { ...album, status } : album,
        ),
      );
    },
    [],
  );

  /**
   * Removes albums, returning a function that puts them back where they were,
   * which matters when they're sorted by when they were added.
   */
  const deleteAlbums = useCallback(
    (ids: string[]) => {
      const removed = albums.flatMap((album, index) =>
        ids.includes(album.id) ? [{ album, index }] : [],
      );
      setAlbums((current) =>
        current.filter((album) => !ids.includes(album.id)),
      );
      return () =>
        setAlbums((current) => {
          const restored = [...current];
          // In their original order, so each index counts the ones before it.
          for (const { album, index } of removed) {
            if (!restored.some(({ id }) => id === album.id)) {
              restored.splice(index, 0, album);
            }
          }
          return restored;
        });
    },
    [albums],
  );

  /** Adds albums from an imported file, skipping any already in the collection. */
  const importAlbums = useCallback(
    (imported: Album[]) => {
      const result = mergeAlbums(albums, imported);
      setAlbums(result.albums);
      return result;
    },
    [albums],
  );

  return {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumsStatus,
    deleteAlbums,
    importAlbums,
  };
}
