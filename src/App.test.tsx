import { render, screen, waitFor, within } from "@testing-library/react";
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

/** Each section's heading, album count and albums, in order. */
const shownSections = () =>
  [...document.querySelectorAll("section")].map((section) => [
    within(section).getByRole("heading").textContent,
    within(section).getByText(/^\d+ albums?$/).textContent,
    [...section.querySelectorAll(".ant-card-meta-title")].map(
      (title) => title.textContent,
    ),
  ]);

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
        addedAt: expect.any(String),
        updatedAt: expect.any(String),
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

  it("warns before adding an album that's already there, but adds it anyway", async () => {
    const user = renderApp([ALBUMS[0]]);

    await user.click(screen.getByRole("button", { name: /add album/i }));
    const dialog = await findDialog("Add album");
    await user.type(within(dialog).getByLabelText("Title"), "kind of blue ");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      '"Kind of Blue" by Miles Davis is already in your collection.',
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add anyway" }),
    );

    expect(saved()).toHaveLength(2);
  });

  it("doesn't warn about another format, or about the album being edited", async () => {
    const user = renderApp([{ ...ALBUMS[0], format: "vinyl" }]);

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    const editing = await findDialog("Edit album");
    expect(within(editing).queryByRole("alert")).toBeNull();
    await user.click(within(editing).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: /add album/i }));
    const adding = await findDialog("Add album");
    await user.type(within(adding).getByLabelText("Title"), "Kind of Blue");
    await user.type(within(adding).getByLabelText("Artist"), "Miles Davis");
    expect(await within(adding).findByRole("alert")).toHaveTextContent(
      "(Vinyl)",
    );
    await user.click(within(adding).getByRole("combobox", { name: /format/i }));
    await user.click(
      document.querySelector('.ant-select-item-option[title="CD"]')!,
    );

    await waitFor(() => expect(within(adding).queryByRole("alert")).toBeNull());
    expect(within(adding).getByRole("button", { name: "Add" })).toBeVisible();
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
      updatedAt: expect.any(String),
    });
  });

  it("sets an album's format, shows it and filters by it", async () => {
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    const dialog = await findDialog("Edit album");
    await user.click(within(dialog).getByRole("combobox", { name: /format/i }));
    await user.click(
      document.querySelector('.ant-select-item-option[title="Vinyl"]')!,
    );
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(saved()[0]).toEqual({
      ...ALBUMS[0],
      format: "vinyl",
      updatedAt: expect.any(String),
    });
    expect(
      await screen.findByText("Vinyl", { selector: ".ant-tag" }),
    ).toBeVisible();

    await choose(user, "Filter by format", "CD");
    expect(cardTitles()).toEqual([]);
    await choose(user, "Filter by format", "Vinyl");
    expect(cardTitles()).toEqual(["Kind of Blue"]);
  });

  it("clears an album's format", async () => {
    const user = renderApp([{ ...ALBUMS[0], format: "cd" }]);

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    const dialog = await findDialog("Edit album");
    await user.click(dialog.querySelector(".ant-select-clear")!);
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saved()).toEqual([
        { ...ALBUMS[0], updatedAt: expect.any(String) },
      ]),
    );
    expect(screen.queryByText("CD", { selector: ".ant-tag" })).toBeNull();
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
      '"In Rainbows" by Radiohead will be removed from your collection.',
    );
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    expect(cardTitles()).toEqual(["Blue Lines", "Kind of Blue"]);
    expect(saved().map((album) => album.id)).toEqual(["1", "3"]);
  });

  it("puts a deleted album back where it was with Undo", async () => {
    const user = renderApp(ALBUMS);
    await user.click(
      screen.getByRole("button", { name: "Delete In Rainbows" }),
    );
    const confirm = await findDialog("Delete this album?");
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText('Deleted "In Rainbows".')).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);
    expect(saved()).toEqual([
      ALBUMS[0],
      { ...ALBUMS[1], updatedAt: expect.any(String) },
      ALBUMS[2],
    ]);
    await waitFor(() =>
      expect(screen.queryByText('Deleted "In Rainbows".')).toBeNull(),
    );
  });

  it("toggles ownership from the card", async () => {
    const user = renderApp(ALBUMS);
    const toggle = screen.getByRole("switch", { name: "Owned: In Rainbows" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(saved()[1].status).toBe("owned");
  });

  it("filters by artist, picked from a list of every artist", async () => {
    const user = renderApp(ALBUMS);
    const artistFilter = screen.getByRole("combobox", {
      name: "Filter by artist",
    });
    // A list to pick from, like the other filters, rather than a field to type
    // in, which would bring up the keyboard on phones.
    expect(artistFilter).toHaveAttribute("readonly");

    await user.click(artistFilter);
    expect(
      [...document.querySelectorAll(".ant-select-item-option")].map(
        (option) => option.textContent,
      ),
    ).toEqual(["All artists", "Massive Attack", "Miles Davis", "Radiohead"]);
    await user.click(
      document.querySelector('.ant-select-item-option[title="Radiohead"]')!,
    );

    expect(cardTitles()).toEqual(["In Rainbows"]);
    expect(screen.getByRole("status")).toHaveTextContent(/^1 album$/);

    await choose(user, "Filter by artist", "All artists");
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);
  });

  it("splits the albums shown into sections, such as by artist", async () => {
    const user = renderApp([
      ...ALBUMS,
      {
        id: "4",
        title: "Mezzanine",
        artist: "Massive Attack",
        status: "wishlisted",
      },
    ]);
    expect(shownSections()).toEqual([]);

    await choose(user, "Group albums", "Group by artist");
    expect(shownSections()).toEqual([
      ["Massive Attack", "2 albums", ["Blue Lines", "Mezzanine"]],
      ["Miles Davis", "1 album", ["Kind of Blue"]],
      ["Radiohead", "1 album", ["In Rainbows"]],
    ]);
    // Only between sections, not before the first or after the last.
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    await choose(user, "Filter by status", "Wishlisted");
    expect(shownSections()).toEqual([
      ["Massive Attack", "1 album", ["Mezzanine"]],
      ["Radiohead", "1 album", ["In Rainbows"]],
    ]);
    expect(screen.getAllByRole("separator")).toHaveLength(1);

    await choose(user, "Group albums", "No grouping");
    expect(shownSections()).toEqual([]);
    expect(screen.queryAllByRole("separator")).toEqual([]);
    expect(cardTitles()).toEqual(["In Rainbows", "Mezzanine"]);
  });

  it("searches, filters by status and sorts", async () => {
    const user = renderApp(ALBUMS);
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);

    await user.type(screen.getByLabelText("Search albums"), "blue");
    expect(cardTitles()).toEqual(["Blue Lines", "Kind of Blue"]);

    await choose(user, "Sort order", "Title (Z-A)");
    expect(cardTitles()).toEqual(["Kind of Blue", "Blue Lines"]);

    await user.clear(screen.getByLabelText("Search albums"));
    await choose(user, "Filter by status", "Wishlisted");
    expect(cardTitles()).toEqual(["In Rainbows"]);
  });

  it("sorts by recently added and counts the albums shown", async () => {
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
    expect(screen.getByRole("status")).toHaveTextContent(/^2 albums$/);

    await choose(user, "Sort order", "Recently added");
    expect(cardTitles()).toEqual(["Kind of Blue", "Blue Lines"]);

    await user.type(screen.getByLabelText("Search albums"), "kind");
    expect(screen.getByRole("status")).toHaveTextContent(/^1 album$/);
    await choose(user, "Filter by status", "Owned");
    expect(screen.getByRole("status")).toHaveTextContent(/^0 albums$/);
    expect(
      screen.getByText("No albums match your search or filter"),
    ).toBeVisible();
  });
});

describe("years and notes", () => {
  const byline = () =>
    document.querySelector(".ant-card-meta-description")?.textContent;

  it("records an album's year and notes, and shows them", async () => {
    const user = renderApp();

    await user.click(
      screen.getByRole("button", { name: /add your first album/i }),
    );
    const dialog = await findDialog("Add album");
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");
    await user.type(within(dialog).getByLabelText(/^Year/), "1959");
    await user.type(
      within(dialog).getByLabelText(/^Notes/),
      " Signed{Enter}First pressing ",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(byline()).toBe("Miles Davis · 1959"));
    expect(saved()).toEqual([
      expect.objectContaining({
        year: 1959,
        notes: "Signed\nFirst pressing",
      }),
    ]);
    await user.click(
      screen.getByRole("button", { name: "Notes on Kind of Blue" }),
    );
    // Only in the document: popovers stay mid-animation in jsdom.
    expect(
      await screen.findByText("Signed First pressing"),
    ).toBeInTheDocument();
  });

  it("won't take a year it can't read", async () => {
    const user = renderApp();

    await user.click(screen.getByRole("button", { name: /add album/i }));
    const dialog = await findDialog("Add album");
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");
    await user.type(within(dialog).getByLabelText(/^Year/), "59");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await within(dialog).findByText("Enter a year, like 1959"),
    ).toBeVisible();
    expect(saved()).toEqual([]);
  });

  it("saves an edit to just the notes", async () => {
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    const dialog = await findDialog("Edit album");
    await user.type(within(dialog).getByLabelText(/^Notes/), "Signed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saved()[0]).toEqual({
        ...ALBUMS[0],
        notes: "Signed",
        updatedAt: expect.any(String),
      }),
    );
  });

  it("sorts by year, and filters by decade or by having no year", async () => {
    const [kindOfBlue, inRainbows, blueLines] = ALBUMS;
    const user = renderApp([
      { ...kindOfBlue, year: 1959 },
      inRainbows,
      { ...blueLines, year: 1991 },
    ]);

    await choose(user, "Sort order", "Year (newest)");
    expect(cardTitles()).toEqual(["Blue Lines", "Kind of Blue", "In Rainbows"]);
    await choose(user, "Filter by year", "1950s");
    expect(cardTitles()).toEqual(["Kind of Blue"]);
    await choose(user, "Filter by year", "No year");
    expect(cardTitles()).toEqual(["In Rainbows"]);
  });

  it("only offers the year filter while some album has a year, and stops filtering without it", async () => {
    const user = renderApp([{ ...ALBUMS[0], year: 1959 }, ALBUMS[1]]);
    await choose(user, "Filter by year", "1950s");
    expect(cardTitles()).toEqual(["Kind of Blue"]);

    await user.click(screen.getByRole("button", { name: "Edit Kind of Blue" }));
    const dialog = await findDialog("Edit album");
    await user.clear(within(dialog).getByLabelText(/^Year/));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(cardTitles()).toEqual(["In Rainbows", "Kind of Blue"]),
    );
    expect(
      screen.queryByRole("combobox", { name: "Filter by year" }),
    ).toBeNull();
  });
});

describe("a long collection", () => {
  // Above 100 albums shown, only the rows near the screen are built.
  const LONG: Album[] = Array.from({ length: 150 }, (_, index) => ({
    id: `long-${index}`,
    title: `Album ${String(index + 1).padStart(3, "0")}`,
    artist: `Artist ${Math.floor(index / 15)}`,
    status: index < 60 ? "wishlisted" : "owned",
  }));

  it("only builds the albums near the top of the page", async () => {
    const user = renderApp(LONG);
    const built = cardTitles();
    expect(built[0]).toBe("Album 001");
    expect(built.length).toBeLessThan(LONG.length);
    expect(built).not.toContain("Album 150");

    // 100 or fewer are all built.
    await choose(user, "Filter by status", "Wishlisted");
    expect(cardTitles()).toHaveLength(60);
  });

  it("does the same in the list, and in sections", async () => {
    const user = renderApp(LONG);
    await user.click(screen.getByText("List"));
    expect(screen.getByText("Album 001")).toBeInTheDocument();
    expect(screen.queryByText("Album 150")).toBeNull();

    await choose(user, "Group albums", "Group by artist");
    expect(
      screen.getByRole("heading", { name: "Artist 0" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Artist 9" })).toBeNull();
  });

  it("selects every album, built or not", async () => {
    const user = renderApp(LONG);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Select albums"));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("150 albums selected")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Mark owned" }));
    expect(saved().every((album) => album.status === "owned")).toBe(true);
  });
});
