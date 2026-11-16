import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "../../App";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const STORAGE_KEY = "album-tracker:albums";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  { id: "2", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
  {
    id: "3",
    title: "Blue Lines",
    artist: "Massive Attack",
    status: "wishlisted",
  },
];

async function startSelecting() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ALBUMS));
  render(<App />, { wrapper: NoMotion });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByText("Select albums"));
  return user;
}

describe("selecting albums", () => {
  it("marks the selected albums as owned", async () => {
    const user = await startSelecting();

    await user.click(
      screen.getByRole("checkbox", { name: "Select In Rainbows" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Select Blue Lines" }),
    );
    expect(screen.getByText("2 albums selected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Mark owned" }));

    expect(saved().map((album) => album.status)).toEqual([
      "owned",
      "owned",
      "owned",
    ]);
    expect(await screen.findByText("Marked 2 albums as owned.")).toBeVisible();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("deletes the selected albums after confirming, with Undo", async () => {
    const user = await startSelecting();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Select Kind of Blue" }),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Delete 2 albums?",
    );
    // Escape closes the dialog without leaving selection mode.
    await user.keyboard("{Escape}");
    expect(screen.getByText("2 albums selected")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(saved().map((album) => album.id)).toEqual(["1"]);

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(saved()).toEqual([
      ALBUMS[0],
      ...ALBUMS.slice(1).map((album) => ({
        ...album,
        updatedAt: expect.any(String),
      })),
    ]);
  });

  it("selects only the albums shown, acts only on those, and stops on Escape", async () => {
    const user = await startSelecting();
    const search = screen.getByLabelText("Search albums");

    await user.type(search, "blue");
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 albums selected")).toBeVisible();
    await user.clear(search);
    await user.type(search, "rainbows");
    expect(screen.getByText("0 albums selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark owned" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.queryByText(/selected$/)).toBeNull();
  });
});
