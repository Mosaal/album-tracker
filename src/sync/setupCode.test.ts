import { describe, expect, it } from "vitest";

import {
  createSetupCode,
  createSetupLink,
  readSetupCode,
  readSetupLink,
} from "./setupCode";

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

describe("setup links", () => {
  it("open the app with the code after the #, which reads back", () => {
    const code = createSetupCode(CONFIG);

    const link = createSetupLink(
      code,
      "https://mosaal.github.io/album-tracker/?from=pwa#albums",
    );

    expect(link).toBe(`https://mosaal.github.io/album-tracker/#setup=${code}`);
    expect(readSetupLink(new URL(link).hash)).toBe(code);
  });

  it.each(["", "#", "#albums", "#setupcode"])(
    "aren't read from the hash %j",
    (hash) => {
      expect(readSetupLink(hash)).toBeUndefined();
    },
  );

  it("hand over a garbled code as it is, to be turned down", () => {
    expect(readSetupLink("#setup=%E0%A4%A")).toBe("%E0%A4%A");
    expect(readSetupCode("%E0%A4%A")).toBeUndefined();
  });
});
