import { describe, expect, it } from "vitest";

import { createSetupCode, readSetupCode } from "./setupCode";

const CONFIG = { repo: "Mosaal/album-collection", token: "github_pat_11A_x-y" };

describe("setup codes", () => {
  it("hold the repository and token, in characters safe to send anywhere", () => {
    const code = createSetupCode(CONFIG);

    expect(code).toMatch(/^album-tracker-sync:[\w-]+$/);
    expect(readSetupCode(code)).toEqual(CONFIG);
  });

  it("still read with spaces or line breaks around them", () => {
    expect(readSetupCode(`\n ${createSetupCode(CONFIG)} \n`)).toEqual(CONFIG);
  });

  it.each([
    ["something else", "github_pat_11A_x-y"],
    ["a damaged code", "album-tracker-sync:eyJyZXBvIjoi"],
    [
      "a code without a token",
      createSetupCode({ repo: "Mosaal/album-collection", token: "" }),
    ],
    [
      "a code with a bad repository",
      createSetupCode({ repo: "album-collection", token: "github_pat_1" }),
    ],
  ])("aren't read from %s", (_, code) => {
    expect(readSetupCode(code)).toBeUndefined();
  });
});
