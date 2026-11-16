import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitHubClient, GitHubError, parseRepo } from "./github";

const fetchMock = vi.fn<typeof fetch>();

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), init);
const status = (code: number, headers?: Record<string, string>) =>
  new Response("{}", { status: code, headers });
// UTF-8 base64, worked out separately.
const BASE64: Record<string, string> = {
  "Björk – Homogenic": "QmrDtnJrIOKAkyBIb21vZ2VuaWM=",
  "Sigur Rós": "U2lndXIgUsOzcw==",
  "lots of albums": "bG90cyBvZiBhbGJ1bXM=",
};

const requestTo = (call = 0) => {
  const [url, init] = fetchMock.mock.calls[call];
  return { url: String(url), ...init };
};

const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("parseRepo", () => {
  it.each([
    ["mosaal/album-collection", "mosaal/album-collection"],
    [" Mosaal/Album.Collection_2 ", "Mosaal/Album.Collection_2"],
    ["https://github.com/mosaal/album-collection", "mosaal/album-collection"],
    ["github.com/mosaal/album-collection/", "mosaal/album-collection"],
    [
      "https://github.com/mosaal/album-collection.git",
      "mosaal/album-collection",
    ],
  ])("reads %j", (input, repo) => {
    expect(parseRepo(input)).toBe(repo);
  });

  it.each(["album-collection", "mosaal/", "-mosaal/albums", "a/b/c", ""])(
    "rejects %j",
    (input) => {
      expect(parseRepo(input)).toBeUndefined();
    },
  );
});

describe("GitHub client", () => {
  const client = createGitHubClient("github_pat_secret");

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the token and API version, and always checks for a newer answer", async () => {
    fetchMock.mockResolvedValue(
      json({ full_name: "Mosaal/album-collection", private: true }),
    );

    expect(await client.getRepo("mosaal/album-collection")).toEqual({
      fullName: "Mosaal/album-collection",
      isPrivate: true,
    });
    expect(requestTo()).toMatchObject({
      url: "https://api.github.com/repos/mosaal/album-collection",
      cache: "no-cache",
      headers: {
        Authorization: "Bearer github_pat_secret",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  });

  it("reads a file as UTF-8, with the version it's at", async () => {
    fetchMock.mockResolvedValue(
      json({
        type: "file",
        sha: "abc123",
        encoding: "base64",
        // GitHub breaks base64 content into lines.
        content: BASE64["Björk – Homogenic"].replace(/(.{8})/g, "$1\n"),
      }),
    );

    expect(await client.getFile("mosaal/albums", "albums.json")).toEqual({
      text: "Björk – Homogenic",
      sha: "abc123",
    });
    expect(requestTo().url).toBe(
      "https://api.github.com/repos/mosaal/albums/contents/albums.json",
    );
  });

  it("reads a file over 1 MB through its blob", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          type: "file",
          sha: "big",
          encoding: "none",
          content: "",
          size: 2e6,
        }),
      )
      .mockResolvedValueOnce(json({ content: BASE64["lots of albums"] }));

    expect(await client.getFile("mosaal/albums", "albums.json")).toEqual({
      text: "lots of albums",
      sha: "big",
    });
    expect(requestTo(1).url).toBe(
      "https://api.github.com/repos/mosaal/albums/git/blobs/big",
    );
  });

  it("finds no file where GitHub has none", async () => {
    fetchMock.mockResolvedValue(status(404));

    expect(
      await client.getFile("mosaal/albums", "albums.json"),
    ).toBeUndefined();
  });

  it("commits a file as UTF-8, replacing the version given", async () => {
    fetchMock.mockResolvedValue(json({}, { status: 200 }));

    await client.putFile("mosaal/albums", "albums.json", {
      text: "Sigur Rós",
      message: "Add Ágætis byrjun",
      sha: "abc123",
    });

    const { url, method, body } = requestTo();
    expect({ url, method }).toEqual({
      url: "https://api.github.com/repos/mosaal/albums/contents/albums.json",
      method: "PUT",
    });
    expect(JSON.parse(String(body))).toEqual({
      message: "Add Ágætis byrjun",
      content: BASE64["Sigur Rós"],
      sha: "abc123",
    });
  });

  it("creates a file when there's no version to replace", async () => {
    fetchMock.mockResolvedValue(json({}, { status: 201 }));

    await client.putFile("mosaal/albums", "albums.json", {
      text: "[]",
      message: "Start syncing 0 albums",
    });

    expect(JSON.parse(String(requestTo().body))).not.toHaveProperty("sha");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [422, "conflict"],
    [502, "unavailable"],
  ])("explains a %i as %s", async (code, reason) => {
    fetchMock.mockResolvedValue(status(code));

    const error = await failureOf(
      client.putFile("mosaal/albums", "albums.json", { text: "", message: "" }),
    );

    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toMatchObject({ reason });
  });

  it("says when the rate limit lifts", async () => {
    fetchMock.mockResolvedValue(
      status(403, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1772360000",
      }),
    );

    const error = await failureOf(client.getRepo("mosaal/albums"));

    expect(error).toMatchObject({
      reason: "rate-limited",
      retryAt: new Date(1772360000 * 1000),
    });
  });

  it("treats a request that never got an answer as offline", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await failureOf(
      client.getFile("mosaal/albums", "albums.json"),
    );

    expect(error).toMatchObject({ reason: "offline" });
  });
});
