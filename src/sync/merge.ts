import { timeOf } from "../albums/timestamps";
import { Album, Collection } from "../types";
import { sameAlbum } from "./syncFile";

/** The more recently changed version of an album. The second wins a tie. */
const newer = (a: Album, b: Album) =>
  timeOf(a.updatedAt) > timeOf(b.updatedAt) ? a : b;

/** Each album once, by id: the newest copy, or the first if they tie. */
function byId(albums: Album[]) {
  const albumsById = new Map<string, Album>();
  for (const album of albums) {
    const other = albumsById.get(album.id);
    albumsById.set(album.id, other ? newer(album, other) : album);
  }
  return albumsById;
}

/**
 * Combines this device's collection with the repository's, so that every
 * device ends up with the same one:
 * - For each album, the most recent change wins. On a tie the repository's
 *   copy wins, so edits made on GitHub stick.
 * - A deletion wins over changes made before it. An album changed after it
 *   was deleted, by an undo or an import, stays, and the deletion is dropped.
 * - Albums keep the repository's order, followed by ones only this device has.
 */
export function mergeCollections(
  local: Collection,
  remote: Collection,
): Collection {
  const localAlbums = byId(local.albums);
  const remoteAlbums = byId(remote.albums);

  const deletedAt = new Map<string, string>();
  for (const { id, deletedAt: time } of [...local.deleted, ...remote.deleted]) {
    const known = deletedAt.get(id);
    if (known === undefined || timeOf(time) > timeOf(known)) {
      deletedAt.set(id, time);
    }
  }

  const ids = [
    ...remoteAlbums.keys(),
    ...[...localAlbums.keys()].filter((id) => !remoteAlbums.has(id)),
  ];
  const albums: Album[] = [];
  for (const id of ids) {
    const mine = localAlbums.get(id);
    const theirs = remoteAlbums.get(id);
    // This device's copy when they're the same, so the albums that didn't
    // change stay as they were and aren't drawn again.
    const album =
      mine && theirs
        ? sameAlbum(mine, theirs)
          ? mine
          : newer(mine, theirs)
        : (theirs ?? mine)!;
    const deletion = deletedAt.get(id);
    if (deletion !== undefined && timeOf(deletion) >= timeOf(album.updatedAt)) {
      continue;
    }
    deletedAt.delete(id);
    albums.push(album);
  }

  return {
    albums,
    deleted: [...deletedAt].map(([id, time]) => ({ id, deletedAt: time })),
  };
}
