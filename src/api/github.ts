import { isRecord } from "../albums/albumFiles";
import { decodeBase64, encodeBase64 } from "../utils/base64";

const API_URL = "https://api.github.com";

// Owners are letters, digits and single hyphens; repository names also allow
// dots and underscores. A pasted URL or clone address works too.
const REPO_NAME =
  /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([a-z\d](?:[a-z\d-]{0,38}))\/([\w.-]{1,100}?)(?:\.git)?\/?$/i;

/** "owner/name" from what someone typed or pasted, or undefined. */
export function parseRepo(input: string) {
  const match = REPO_NAME.exec(input.trim());
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Why a request to GitHub failed. */
export type GitHubErrorReason =
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "not-found"
  | "conflict"
  | "unavailable";

export class GitHubError extends Error {
  constructor(
    readonly reason: GitHubErrorReason,
    message: string,
    /** When a rate limit lifts. */
    readonly retryAt?: Date,
  ) {
    super(message);
  }
}

export interface GitHubRepo {
  /** "owner/name", as GitHub spells it. */
  fullName: string;
  isPrivate: boolean;
}

export interface GitHubFile {
  text: string;
  /** Identifies this version of the file, to replace it without losing a newer one. */
  sha: string;
}

export interface GitHubFileChange {
  text: string;
  /** The commit message. */
  message: string;
  /** The version being replaced. Leave it out to create the file. */
  sha?: string;
}

export interface GitHubClient {
  getRepo: (repo: string) => Promise<GitHubRepo>;
  /** The file on the default branch, or undefined if there isn't one. */
  getFile: (repo: string, path: string) => Promise<GitHubFile | undefined>;
  /**
   * Commits the file to the default branch. Throws a "conflict" GitHubError if
   * it changed since `sha`, or already exists when creating it.
   */
  putFile: (
    repo: string,
    path: string,
    change: GitHubFileChange,
  ) => Promise<void>;
}

function toError(response: Response) {
  const { status, headers } = response;
  const retryAfter = Number(headers.get("retry-after"));
  const resetAt = Number(headers.get("x-ratelimit-reset"));
  if (
    (status === 403 || status === 429) &&
    (retryAfter > 0 || headers.get("x-ratelimit-remaining") === "0")
  ) {
    return new GitHubError(
      "rate-limited",
      "GitHub's rate limit was reached",
      retryAfter > 0
        ? new Date(Date.now() + retryAfter * 1000)
        : resetAt > 0
          ? new Date(resetAt * 1000)
          : undefined,
    );
  }
  const reasons: Record<number, GitHubErrorReason> = {
    401: "unauthorized",
    403: "forbidden",
    404: "not-found",
    409: "conflict",
    // Also what GitHub says when creating a file that already exists.
    422: "conflict",
  };
  return new GitHubError(
    reasons[status] ?? "unavailable",
    `GitHub answered ${status}`,
  );
}

const repoPath = (repo: string) =>
  repo.split("/").map(encodeURIComponent).join("/");

/** Reads and writes repositories with a personal access token. */
export function createGitHubClient(token: string): GitHubClient {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        // GitHub lets browsers reuse answers for a minute, which could hide
        // another device's save. Checking back costs nothing against the limit.
        cache: "no-cache",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...init?.headers,
        },
      });
    } catch {
      throw new GitHubError("offline", "Couldn't reach GitHub");
    }
    if (!response.ok) {
      throw toError(response);
    }
    return response.json();
  }

  return {
    async getRepo(repo) {
      const data = await request(`/repos/${repoPath(repo)}`);
      if (!isRecord(data) || typeof data.full_name !== "string") {
        throw new GitHubError(
          "unavailable",
          "GitHub sent an unexpected answer",
        );
      }
      return { fullName: data.full_name, isPrivate: data.private === true };
    },

    async getFile(repo, path) {
      let data: unknown;
      try {
        data = await request(`/repos/${repoPath(repo)}/contents/${path}`);
      } catch (error) {
        if (error instanceof GitHubError && error.reason === "not-found") {
          return undefined;
        }
        throw error;
      }
      if (
        !isRecord(data) ||
        data.type !== "file" ||
        typeof data.sha !== "string"
      ) {
        throw new GitHubError("unavailable", `${path} isn't a file`);
      }
      let content = typeof data.content === "string" ? data.content : "";
      // Files over 1 MB come without their content.
      if (
        data.encoding === "none" ||
        (content === "" && Number(data.size) > 0)
      ) {
        const blob = await request(
          `/repos/${repoPath(repo)}/git/blobs/${data.sha}`,
        );
        content =
          isRecord(blob) && typeof blob.content === "string"
            ? blob.content
            : "";
      }
      return { text: decodeBase64(content), sha: data.sha };
    },

    async putFile(repo, path, { text, message, sha }) {
      await request(`/repos/${repoPath(repo)}/contents/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          content: encodeBase64(text),
          ...(sha ? { sha } : {}),
        }),
      });
    },
  };
}
