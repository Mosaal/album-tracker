import { useCallback, useEffect, useState } from "react";

import { mergeAlbums } from "../backup";
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

  const setAlbumStatus = useCallback((id: string, status: Album["status"]) => {
    setAlbums((current) =>
      current.map((album) => (album.id === id ? { ...album, status } : album)),
    );
  }, []);

  const deleteAlbum = useCallback((id: string) => {
    setAlbums((current) => current.filter((album) => album.id !== id));
  }, []);

  /** Adds albums from a backup, skipping any already in the collection. */
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
    setAlbumStatus,
    deleteAlbum,
    importAlbums,
  };
}
