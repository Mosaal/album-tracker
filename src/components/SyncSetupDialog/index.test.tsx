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
import { readJson } from "../../json";
import { createSetupCode } from "../../sync/setupCode";
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

let github: ReturnType<typeof createFakeGitHub>;

function stubGitHub(options?: Parameters<typeof createFakeGitHub>[0]) {
  github = createFakeGitHub(options);
  vi.stubGlobal("fetch", github.fetch);
}

function renderApp(albums: Album[] = []) {
  localStorage.setItem("album-tracker:albums", JSON.stringify(albums));
  render(<App />, { wrapper: NoMotion });
  return userEvent.setup();
}

const cardTitles = () =>
  [...document.querySelectorAll(".ant-card-meta-title")].map(
    (title) => title.textContent,
  );

/** The open dialog that says this; a confirmation can open over another. */
const findDialog = (text: string) =>
  waitFor(() => {
    const dialog = screen
      .getAllByRole("dialog")
      .find((element) => element.textContent?.includes(text));
    expect(dialog).toBeDefined();
    return dialog!;
  });

async function openSetup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByText("Sync with GitHub…"));
  return findDialog("Keep your collection in a GitHub repository");
}

async function fillInNewSetup(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  token = github.token,
) {
  await user.type(
    within(dialog).getByLabelText("Repository"),
    "mosaal/album-collection",
  );
  await user.type(within(dialog).getByLabelText("Token"), token);
  await user.click(within(dialog).getByRole("button", { name: "Connect" }));
}

describe("setting up sync", () => {
  beforeEach(() => {
    stubGitHub();
  });

  afterEach(() => {
    // Anything still on its way fails, rather than reaching GitHub.
    github.online = false;
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("starts the collection on GitHub with this device's albums", async () => {
    const user = renderApp([KIND_OF_BLUE, IN_RAINBOWS]);

    await fillInNewSetup(user, await openSetup(user));

    expect(
      await screen.findByText("Syncing with Mosaal/album-collection."),
    ).toBeVisible();
    expect(github.commits.map((commit) => commit.message)).toEqual([
      "Start syncing 2 albums",
    ]);
    expect(
      screen.getByRole("button", { name: /^GitHub sync: Synced at/ }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByText("Sync settings…")).toBeInTheDocument();
  });

  it("links to GitHub's token form, filled in for the repository's owner", async () => {
    const user = renderApp();
    const dialog = await openSetup(user);

    await user.type(
      within(dialog).getByLabelText("Repository"),
      "https://github.com/Mosaal/album-collection",
    );

    const link = within(dialog).getByRole("link", { name: /create a token/i });
    expect(
      Object.fromEntries(new URL(link.getAttribute("href")!).searchParams),
    ).toMatchObject({
      name: "Album Tracker",
      target_name: "Mosaal",
      expires_in: "none",
      contents: "write",
    });
  });

  it("explains what's missing or wrong before connecting", async () => {
    const user = renderApp();
    const dialog = await openSetup(user);

    await user.click(within(dialog).getByRole("button", { name: "Connect" }));
    expect(
      await within(dialog).findByText("Enter the repository"),
    ).toBeVisible();
    expect(within(dialog).getByText("Paste the token")).toBeVisible();

    await user.type(
      within(dialog).getByLabelText("Repository"),
      "album-collection",
    );
    expect(
      await within(dialog).findByText(
        "Enter it as owner/name, like your-name/album-collection",
      ),
    ).toBeVisible();
    expect(github.fetch).not.toHaveBeenCalled();
  });

  it("says when GitHub turns the token down", async () => {
    const user = renderApp([KIND_OF_BLUE]);
    const dialog = await openSetup(user);

    await fillInNewSetup(user, dialog, "github_pat_wrong");

    expect(
      await within(dialog).findByText(
        "GitHub didn't accept the token. It may have expired or been deleted.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /^GitHub sync/ })).toBeNull();
  });

  it("asks before using a public repository", async () => {
    stubGitHub({ isPrivate: false });
    const user = renderApp([KIND_OF_BLUE]);
    const dialog = await openSetup(user);

    await fillInNewSetup(user, dialog);
    const warning = await findDialog("Use a public repository?");
    await user.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(github.commits).toEqual([]);

    await user.click(
      await within(dialog).findByRole("button", { name: "Connect" }),
    );
    await user.click(
      within(await findDialog("Use a public repository?")).getByRole("button", {
        name: "Use it anyway",
      }),
    );
    expect(
      await screen.findByText("Syncing with Mosaal/album-collection."),
    ).toBeVisible();
  });

  it("asks before replacing albums only this device has, offering to export them", async () => {
    github.save(createSyncFile({ albums: [KIND_OF_BLUE], deleted: [] }));
    URL.createObjectURL = vi.fn(() => "blob:download");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = renderApp([KIND_OF_BLUE, IN_RAINBOWS]);

    await fillInNewSetup(user, await openSetup(user));
    const confirm = await findDialog("Replace this device's albums?");
    expect(confirm).toHaveTextContent(
      "This device's 2 albums will be replaced by the 1 album in Mosaal/album-collection. One of them isn't there, so export a copy first to keep it.",
    );

    await user.click(
      within(confirm).getByRole("button", { name: "Export first" }),
    );
    const exported = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(readJson(await exported.text()).albums).toHaveLength(2);

    await user.click(within(confirm).getByRole("button", { name: "Replace" }));
    expect(
      await screen.findByText("Syncing with Mosaal/album-collection."),
    ).toBeVisible();
    expect(cardTitles()).toEqual(["Kind of Blue"]);
    expect(github.commits).toHaveLength(1);
  });

  it("connects another device with a setup code", async () => {
    github.save(createSyncFile({ albums: [IN_RAINBOWS], deleted: [] }));
    const user = renderApp();
    const dialog = await openSetup(user);

    await user.click(within(dialog).getByRole("tab", { name: "Setup code" }));
    const field = within(dialog).getByRole("textbox", { name: "Setup code" });
    await user.type(field, "not a code");
    await user.click(within(dialog).getByRole("button", { name: "Connect" }));
    expect(
      await within(dialog).findByText(
        "That isn't a setup code from Album Tracker",
      ),
    ).toBeVisible();

    await user.clear(field);
    await user.click(field);
    await user.paste(
      createSetupCode({ repo: github.repo, token: github.token }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText("Syncing with Mosaal/album-collection."),
    ).toBeVisible();
    expect(cardTitles()).toEqual(["In Rainbows"]);
  });

  describe("from another device's QR code", () => {
    const openLink = (code: string) =>
      window.history.replaceState(null, "", `/album-tracker/#setup=${code}`);

    it("opens with the setup code filled in, and takes it out of the address", async () => {
      github.save(createSyncFile({ albums: [IN_RAINBOWS], deleted: [] }));
      openLink(createSetupCode({ repo: github.repo, token: github.token }));
      const user = renderApp();

      const dialog = await findDialog(
        "Keep your collection in a GitHub repository",
      );
      expect(
        within(dialog).getByRole("tab", { name: "Setup code" }),
      ).toHaveAttribute("aria-selected", "true");
      expect(window.location.href).toBe("http://localhost:3000/album-tracker/");
      await user.click(within(dialog).getByRole("button", { name: "Connect" }));

      expect(
        await screen.findByText("Syncing with Mosaal/album-collection."),
      ).toBeVisible();
      expect(cardTitles()).toEqual(["In Rainbows"]);
    });

    it("starts setup again when the link reaches the app while it's open", async () => {
      github.save(createSyncFile({ albums: [IN_RAINBOWS], deleted: [] }));
      const user = renderApp();
      await openSetup(user);

      window.location.hash = `#setup=${createSetupCode({ repo: github.repo, token: github.token })}`;

      await waitFor(() =>
        expect(screen.getByRole("tab", { name: "Setup code" })).toHaveAttribute(
          "aria-selected",
          "true",
        ),
      );
      expect(window.location.hash).toBe("");
      await user.click(screen.getByRole("button", { name: "Connect" }));

      expect(
        await screen.findByText("Syncing with Mosaal/album-collection."),
      ).toBeVisible();
      expect(cardTitles()).toEqual(["In Rainbows"]);
    });

    it("says so on a device that already syncs", async () => {
      localStorage.setItem(
        "album-tracker:github-sync",
        JSON.stringify({ repo: github.repo, token: github.token }),
      );
      openLink(
        createSetupCode({ repo: "Mosaal/old-albums", token: github.token }),
      );
      renderApp();

      expect(
        await screen.findByText(
          "This device already syncs with Mosaal/album-collection. To use Mosaal/old-albums instead, disconnect it in Sync settings first.",
        ),
      ).toBeVisible();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(window.location.hash).toBe("");
    });

    it("says when the code can't be read", async () => {
      openLink("album-tracker-sync:not-a-code");
      renderApp();

      expect(
        await screen.findByText("That link's setup code couldn't be read."),
      ).toBeVisible();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
