import { isRecord } from "../albumFiles";
import { parseRepo } from "../api/github";
import { decodeBase64, encodeBase64 } from "../base64";
import { SyncConfig } from "./config";

const PREFIX = "album-tracker-sync:";

// GitHub tokens are printable ASCII, and anything else can't go in a header.
export const isTokenLike = (token: string) => /^[\x21-\x7e]+$/.test(token);

/**
 * A code holding the repository and token, to connect another device by
 * pasting one thing. Base64url, so it survives being sent around.
 */
export function createSetupCode({ repo, token }: SyncConfig) {
  const encoded = encodeBase64(JSON.stringify({ repo, token }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${PREFIX}${encoded}`;
}

/** The repository and token in a setup code, or undefined if it isn't one. */
export function readSetupCode(code: string): SyncConfig | undefined {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) {
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(
      decodeBase64(
        trimmed.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/"),
      ),
    );
  } catch {
    return undefined;
  }
  if (
    !isRecord(data) ||
    typeof data.repo !== "string" ||
    typeof data.token !== "string" ||
    !isTokenLike(data.token)
  ) {
    return undefined;
  }
  const repo = parseRepo(data.repo);
  return repo ? { repo, token: data.token } : undefined;
}
