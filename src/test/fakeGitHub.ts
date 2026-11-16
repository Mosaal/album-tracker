import { vi } from "vitest";

import { decodeBase64, encodeBase64 } from "../base64";

interface FakeGitHubOptions {
  repo?: string;
  isPrivate?: boolean;
  token?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const failure = (status: number) => new Response("{}", { status });

/**
 * Stands in for GitHub's API, through fetch: one repository, which may hold
 * albums.json. Saves follow GitHub's rules, so a save based on an old version
 * of the file is turned down.
 */
export function createFakeGitHub({
  repo = "Mosaal/album-collection",
  isPrivate = true,
  token = "github_pat_good",
}: FakeGitHubOptions = {}) {
  let file: { text: string; sha: string } | undefined;
  let version = 0;

  const github = {
    repo,
    isPrivate,
    /** The one token GitHub accepts. */
    token,
    online: true,
    commits: [] as { message: string; text: string }[],
    /** Answers the next request with this status instead. */
    failNextWith: undefined as number | undefined,
    /** Runs when a save arrives, before GitHub looks at it. */
    beforeNextSave: undefined as (() => unknown) | undefined,

    get text() {
      return file?.text;
    },

    /** Commits albums.json, as another device or an edit on GitHub would. */
    save(text: string, message = "Edit albums.json") {
      file = { text, sha: `sha-${++version}` };
      github.commits.push({ message, text });
    },

    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!github.online) {
        throw new TypeError("Failed to fetch");
      }
      if (github.failNextWith) {
        const status = github.failNextWith;
        github.failNextWith = undefined;
        return failure(status);
      }
      if (
        new Headers(init?.headers).get("Authorization") !==
        `Bearer ${github.token}`
      ) {
        return failure(401);
      }

      const path = decodeURIComponent(new URL(String(input)).pathname);
      const method = init?.method ?? "GET";
      const repoPath = `/repos/${repo}`.toLowerCase();
      if (method === "GET" && path.toLowerCase() === repoPath) {
        return json({ full_name: repo, private: isPrivate });
      }
      if (path.toLowerCase() !== `${repoPath}/contents/albums.json`) {
        return failure(404);
      }
      if (method === "GET") {
        return file
          ? json({
              type: "file",
              sha: file.sha,
              encoding: "base64",
              content: encodeBase64(file.text),
            })
          : failure(404);
      }

      const save = github.beforeNextSave;
      github.beforeNextSave = undefined;
      await save?.();
      const body = JSON.parse(String(init?.body));
      if (file && body.sha !== file.sha) {
        // Creating a file that exists gets a 422; replacing an old version, a 409.
        return failure(body.sha ? 409 : 422);
      }
      github.save(decodeBase64(body.content), body.message);
      return json({}, 201);
    }),
  };
  return github;
}

/** A Storage kept in memory, for a device of its own. */
export function createMemoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}
