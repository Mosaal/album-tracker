/** GitHub pages the sync dialogs link to. */

export const repoUrl = (repo: string) => `https://github.com/${repo}`;

/** Every saved change, newest first: the collection's history and backup. */
export const historyUrl = (repo: string) =>
  `https://github.com/${repo}/commits/HEAD/albums.json`;

export const NEW_REPO_URL = `https://github.com/new?${new URLSearchParams({
  name: "album-collection",
  visibility: "private",
  description: "My album collection, synced by Album Tracker",
})}`;

/**
 * GitHub's form for a fine-grained token, filled in as far as links allow:
 * everything except picking the repository.
 */
export function newTokenUrl(owner?: string) {
  const params = new URLSearchParams({
    name: "Album Tracker",
    description:
      "Lets Album Tracker read and save albums.json in your album repository.",
    ...(owner ? { target_name: owner } : {}),
    expires_in: "none",
    contents: "write",
  });
  return `https://github.com/settings/personal-access-tokens/new?${params}`;
}
