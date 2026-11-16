import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import App from "../../App";
import { readSetupCode } from "../../sync/setupCode";
import { createSyncFile } from "../../sync/syncFile";
import { createFakeGitHub } from "../../test/fakeGitHub";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const KIND_OF_BLUE: Album = {
  id: "1",
  title: "Kind of Blue",
  artist: "Miles Davis",
  status: "owned",
};
const IN_RAINBOWS: Album = {
  id: "2",
  title: "In Rainbows",
  artist: "Radiohead",
  status: "wishlisted",
};

const CONFIG_KEY = "album-tracker:github-sync";
let github: ReturnType<typeof createFakeGitHub>;

/** The app on a device that already syncs, with KIND_OF_BLUE on GitHub. */
function renderSyncingApp(token = github.token) {
  github.save(createSyncFile({ albums: [KIND_OF_BLUE], deleted: [] }));
  localStorage.setItem("album-tracker:albums", JSON.stringify([KIND_OF_BLUE]));
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ repo: github.repo, token }),
  );
  render(<App />, { wrapper: NoMotion });
  return userEvent.setup();
}

const cardTitles = () =>
  [...document.querySelectorAll(".ant-card-meta-title")].map(
    (title) => title.textContent,
  );

const findDialog = (text: string) =>
  waitFor(() => {
    const dialog = screen
      .getAllByRole("dialog")
      .find((element) => element.textContent?.includes(text));
    expect(dialog).toBeDefined();
    return dialog!;
  });

async function openSettings(
  user: ReturnType<typeof userEvent.setup>,
  status: RegExp = /Synced at/,
) {
  await user.click(
    await screen.findByRole("button", {
      name: new RegExp(`^GitHub sync: ${status.source}`),
    }),
  );
  return findDialog("Sync settings");
}

describe("sync settings", () => {
  beforeEach(() => {
    github = createFakeGitHub();
    vi.stubGlobal("fetch", github.fetch);
  });

  afterEach(() => {
    // Anything still on its way fails, rather than reaching GitHub.
    github.online = false;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("links to the repository and its history, and syncs on request", async () => {
    const user = renderSyncingApp();
    const dialog = await openSettings(user);

    expect(
      within(dialog).getByRole("link", { name: /Mosaal\/album-collection/ }),
    ).toHaveAttribute("href", "https://github.com/Mosaal/album-collection");
    expect(
      within(dialog).getByRole("link", { name: /history/ }),
    ).toHaveAttribute(
      "href",
      "https://github.com/Mosaal/album-collection/commits/HEAD/albums.json",
    );

    // Another device adds an album.
    github.save(
      createSyncFile({ albums: [KIND_OF_BLUE, IN_RAINBOWS], deleted: [] }),
    );
    await user.click(within(dialog).getByRole("button", { name: /Sync now/ }));

    await waitFor(() =>
      expect(cardTitles()).toEqual(["In Rainbows", "Kind of Blue"]),
    );
  });

  it("copies a setup code for other devices", async () => {
    const user = renderSyncingApp();
    const dialog = await openSettings(user);

    await user.click(
      within(dialog).getByRole("button", { name: /Copy setup code/ }),
    );

    expect(
      await screen.findByText(
        "Setup code copied. Paste it on your other device.",
      ),
    ).toBeVisible();
    expect(readSetupCode(await navigator.clipboard.readText())).toEqual({
      repo: github.repo,
      token: github.token,
    });
  });

  it("shows the setup code to copy by hand when the clipboard can't be used", async () => {
    const user = renderSyncingApp();
    const dialog = await openSettings(user);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Not allowed", "NotAllowedError"),
    );

    await user.click(
      within(dialog).getByRole("button", { name: /Copy setup code/ }),
    );

    const code = await within(dialog).findByRole("textbox", {
      name: "Setup code",
    });
    expect(readSetupCode((code as HTMLTextAreaElement).value)).toEqual({
      repo: github.repo,
      token: github.token,
    });
  });

  it("explains a token GitHub no longer accepts, and takes a new one", async () => {
    const user = renderSyncingApp("github_pat_expired");
    const dialog = await openSettings(user, /GitHub didn't accept the token/);
    expect(dialog).toHaveTextContent(
      "GitHub didn't accept the token. It may have expired or been deleted.",
    );

    await user.type(within(dialog).getByLabelText("New token"), github.token);
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Token saved.")).toBeVisible();
    expect(
      await screen.findByRole("button", { name: /^GitHub sync: Synced at/ }),
    ).toBeVisible();
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY)!).token).toBe(
      github.token,
    );
  });

  it("disconnects this device, keeping its albums", async () => {
    const user = renderSyncingApp();
    const dialog = await openSettings(user);

    await user.click(
      within(dialog).getByRole("button", { name: "Disconnect" }),
    );
    const confirm = await findDialog("Disconnect this device?");
    await user.click(
      within(confirm).getByRole("button", { name: "Disconnect" }),
    );

    expect(
      await screen.findByText("This device has stopped syncing."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^GitHub sync/ })).toBeNull();
    expect(localStorage.getItem(CONFIG_KEY)).toBeNull();
    expect(cardTitles()).toEqual(["Kind of Blue"]);
  });
});
