import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "../../App";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const ALBUMS_KEY = "album-tracker:albums";
const SETTINGS_KEY = "album-tracker:settings";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(ALBUMS_KEY) ?? "[]");

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

function renderApp(albums: Album[] = [KIND_OF_BLUE]) {
  localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
  const result = render(<App />, { wrapper: NoMotion });
  return { user: userEvent.setup(), ...result };
}

// jsdom's window is 1024px wide, where the normal grid has 4 columns.
const gridColumns = () =>
  getComputedStyle(document.querySelector(".ant-card")!.parentElement!)
    .gridTemplateColumns;
const columns = (count: number) => `repeat(${count}, minmax(0px, 1fr))`;

/** The space around an album's details on its card. */
const detailsPadding = () =>
  getComputedStyle(document.querySelector(".ant-card-body")!).padding;

async function findDialog(title: string) {
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(title);
  return dialog;
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByText("Settings…"));
  return findDialog("Settings");
}

async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add album/i }));
  return findDialog("Add album");
}

/** The format chosen in the album form, or its placeholder. */
const formatIn = (dialog: HTMLElement) =>
  within(dialog)
    .getByRole("combobox", { name: /format/i })
    .closest(".ant-select")!.textContent;

/** The albums shown, in order, in the grid or the list. */
const shownTitles = () =>
  screen
    .getAllByRole("button", { name: /^Edit / })
    .map((button) => button.getAttribute("aria-label")!.slice("Edit ".length));

const isListShown = () =>
  (screen.getByRole("radio", { name: "List" }) as HTMLInputElement).checked;

/** The headings of the sections the albums are grouped into, if they are. */
const sectionHeadings = () =>
  screen
    .queryAllByRole("heading", { level: 5 })
    .map((heading) => heading.textContent);

describe("settings", () => {
  it("fits one more album in each row of the compact grid, and remembers it", async () => {
    const { user, unmount } = renderApp();
    expect(gridColumns()).toBe(columns(4));

    const dialog = await openSettings(user);
    await user.click(within(dialog).getByText("Compact"));

    expect(gridColumns()).toBe(columns(5));
    unmount();
    renderApp();
    expect(gridColumns()).toBe(columns(5));
  });

  it("gives albums in the compact grid less padding around their details", async () => {
    const { user } = renderApp();
    expect(detailsPadding()).toBe("24px");

    const dialog = await openSettings(user);
    await user.click(within(dialog).getByText("Compact"));

    expect(detailsPadding()).toBe("12px");
  });

  it("opens with the view, sort order and grouping last chosen", async () => {
    const { user, unmount } = renderApp([KIND_OF_BLUE, IN_RAINBOWS]);
    expect(shownTitles()).toEqual(["In Rainbows", "Kind of Blue"]);

    await user.click(screen.getByText("List"));
    await user.click(screen.getByRole("combobox", { name: "Sort order" }));
    await user.click(
      document.querySelector('.ant-select-item-option[title="Artist (A-Z)"]')!,
    );
    await user.click(screen.getByRole("combobox", { name: "Group albums" }));
    await user.click(
      document.querySelector(
        '.ant-select-item-option[title="Group by artist"]',
      )!,
    );
    unmount();
    renderApp([KIND_OF_BLUE, IN_RAINBOWS]);

    expect(isListShown()).toBe(true);
    expect(document.querySelector(".ant-card-meta-title")).toBeNull();
    expect(shownTitles()).toEqual(["Kind of Blue", "In Rainbows"]);
    expect(sectionHeadings()).toEqual(["Miles Davis", "Radiohead"]);
  });

  it("starts new albums in the chosen format, leaving edits alone", async () => {
    const { user } = renderApp();
    const settings = await openSettings(user);
    await user.click(
      within(settings).getByRole("combobox", { name: "Format for new albums" }),
    );
    await user.click(
      document.querySelector('.ant-select-item-option[title="CD"]')!,
    );
    await user.click(within(settings).getByRole("button", { name: "Done" }));

    const adding = await openAddForm(user);
    expect(formatIn(adding)).toBe("CD");
    await user.type(within(adding).getByLabelText("Title"), "Milestones");
    await user.type(within(adding).getByLabelText("Artist"), "Miles Davis");
    await user.click(within(adding).getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Milestones")).toBeInTheDocument();
    expect(saved()[1]).toMatchObject({ title: "Milestones", format: "cd" });

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    expect(formatIn(await findDialog("Edit album"))).toBe("Choose a format");
  });

  it("stays in step with settings changed in another tab", async () => {
    const { user } = renderApp();

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ gridDensity: "compact", defaultFormat: "vinyl" }),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_KEY }));
    });

    expect(gridColumns()).toBe(columns(5));
    expect(formatIn(await openAddForm(user))).toBe("Vinyl");
  });

  it("uses the usual settings in place of ones it can't read", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        gridDensity: "tiny",
        defaultFormat: "8-track",
        viewMode: "table",
        sortOrder: "year",
        grouping: "genre",
      }),
    );
    const { user } = renderApp([KIND_OF_BLUE, IN_RAINBOWS]);

    expect(gridColumns()).toBe(columns(4));
    expect(isListShown()).toBe(false);
    expect(shownTitles()).toEqual(["In Rainbows", "Kind of Blue"]);
    expect(sectionHeadings()).toEqual([]);
    expect(formatIn(await openAddForm(user))).toBe("Choose a format");
  });
});
