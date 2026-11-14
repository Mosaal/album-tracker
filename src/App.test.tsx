import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "./App";
import { NoMotion } from "./test/NoMotion";
import { Album } from "./types";

const STORAGE_KEY = "album-tracker:albums";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  { id: "2", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
  { id: "3", title: "Blue Lines", artist: "Massive Attack", status: "owned" },
];

function renderApp(albums: Album[] = []) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
  render(<App />, { wrapper: NoMotion });
  return userEvent.setup();
}

const cardTitles = () =>
  [...document.querySelectorAll(".ant-card-meta-title")].map(
    (title) => title.textContent,
  );

// antd gives every generated id the same value under test, so dialogs can't be
// found by their accessible name. Find the open one and check its title instead.
async function findDialog(title: string) {
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(title);
  return dialog;
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  select: string,
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name: select }));
  await user.click(
    document.querySelector(`.ant-select-item-option[title="${option}"]`)!,
  );
}

describe("App", () => {
  it("adds an album from the empty state", async () => {
    const user = renderApp();

    await user.click(
      screen.getByRole("button", { name: /add your first album/i }),
    );
    const dialog = await findDialog("Add album");
    await user.type(within(dialog).getByLabelText("Title"), " Kind of Blue ");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Kind of Blue")).toBeInTheDocument();
    expect(saved()).toEqual([
      {
        id: expect.any(String),
        title: "Kind of Blue",
        artist: "Miles Davis",
        status: "owned",
      },
    ]);
  });

  it("won't add an album without a title and artist", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: /add album/i }));
    const dialog = await findDialog("Add album");
    await user.type(within(dialog).getByLabelText("Title"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByText("Enter a title")).toBeVisible();
    expect(await within(dialog).findByText("Enter an artist")).toBeVisible();
    expect(saved()).toEqual([]);
  });

  it("edits an album", async () => {
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "Edit In Rainbows" }));
    const dialog = await findDialog("Edit album");
    const title = within(dialog).getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "In Rainbows (Disk 2)");
    await user.click(within(dialog).getByText("Owned"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("In Rainbows (Disk 2)")).toBeInTheDocument();
    expect(saved()[1]).toEqual({
      id: "2",
      title: "In Rainbows (Disk 2)",
      artist: "Radiohead",
      status: "owned",
    });
  });

  it("deletes an album only after confirming", async () => {
    const user = renderApp(ALBUMS);

    await user.click(
      screen.getByRole("button", { name: "Delete In Rainbows" }),
    );
    const cancelled = await findDialog("Delete this album?");
    await user.click(within(cancelled).getByRole("button", { name: "Cancel" }));
    expect(saved()).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Delete In Rainbows" }),
    );
    const confirm = await findDialog(
      '"In Rainbows" by Radiohead will be permanently removed.',
    );
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    expect(cardTitles()).toEqual(["Blue Lines", "Kind of Blue"]);
    expect(saved().map((album) => album.id)).toEqual(["1", "3"]);
  });

  it("toggles ownership from the card", async () => {
    const user = renderApp(ALBUMS);
    const toggle = screen.getByRole("switch", { name: "Owned: In Rainbows" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(saved()[1].status).toBe("owned");
  });

  it("searches, filters by status and sorts", async () => {
    const user = renderApp(ALBUMS);
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);

    await user.type(screen.getByLabelText("Search albums"), "blue");
    expect(cardTitles()).toEqual(["Blue Lines", "Kind of Blue"]);

    await choose(user, "Sort order", "Title (Z-A)");
    expect(cardTitles()).toEqual(["Kind of Blue", "Blue Lines"]);

    await user.clear(screen.getByLabelText("Search albums"));
    await choose(user, "Filter by status", "Wishlisted (1)");
    expect(cardTitles()).toEqual(["In Rainbows"]);
  });

  it("sorts by recently added and counts albums by status", async () => {
    const user = renderApp([
      {
        id: "1",
        title: "Blue Lines",
        artist: "Massive Attack",
        status: "owned",
      },
      {
        id: "2",
        title: "Kind of Blue",
        artist: "Miles Davis",
        status: "wishlisted",
      },
    ]);
    expect(screen.getByTitle("All albums (2)")).toBeInTheDocument();

    await choose(user, "Sort order", "Recently added");
    expect(cardTitles()).toEqual(["Kind of Blue", "Blue Lines"]);

    await user.type(screen.getByLabelText("Search albums"), "kind");
    expect(screen.getByTitle("All albums (1)")).toBeInTheDocument();
    await choose(user, "Filter by status", "Owned (0)");
    expect(
      screen.getByText("No albums match your search or filter"),
    ).toBeVisible();
  });
});
