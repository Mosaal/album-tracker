import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CoverResult,
  CoverSearchError,
  searchCovers,
} from "../../api/coverArt";
import { NoMotion } from "../../test/NoMotion";
import { AlbumFormModal } from "../AlbumFormModal";

vi.mock("../../api/coverArt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/coverArt")>()),
  searchCovers: vi.fn(),
}));

const KIND_OF_BLUE: CoverResult = {
  id: "rg-1",
  title: "Kind of Blue",
  artist: "Miles Davis",
  year: "1959",
  thumbnailUrl: "https://coverartarchive.org/release-group/rg-1/front-250",
  imageUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
};

async function renderForm() {
  const onSubmit = vi.fn();
  render(
    <AlbumFormModal open albums={[]} onSubmit={onSubmit} onCancel={vi.fn()} />,
    { wrapper: NoMotion },
  );
  const dialog = await screen.findByRole("dialog");
  return { user: userEvent.setup(), dialog, onSubmit };
}

describe("cover search in the album form", () => {
  beforeEach(() => {
    vi.mocked(searchCovers).mockReset();
  });

  it("needs a title before it can search", async () => {
    const { user, dialog } = await renderForm();
    const findCovers = within(dialog).getByRole("button", {
      name: /find covers/i,
    });
    expect(findCovers).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");

    expect(findCovers).toBeEnabled();
  });

  it("fills in the cover URL with the cover you pick", async () => {
    vi.mocked(searchCovers).mockResolvedValue([KIND_OF_BLUE]);
    const { user, dialog, onSubmit } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );
    const cover = await within(dialog).findByRole("button", {
      name: "Kind of Blue 1959 · Miles Davis",
    });
    await user.click(cover);

    expect(searchCovers).toHaveBeenCalledWith(
      "Kind of Blue",
      "Miles Davis",
      expect.any(AbortSignal),
    );
    expect(within(dialog).getByLabelText(/cover image url/i)).toHaveValue(
      KIND_OF_BLUE.imageUrl,
    );
    expect(cover).toHaveAttribute("aria-pressed", "true");

    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ coverUrl: KIND_OF_BLUE.imageUrl }),
    );
  });

  it("fills in the year from the cover you pick, but not over one you typed", async () => {
    const reissue: CoverResult = {
      ...KIND_OF_BLUE,
      id: "rg-2",
      year: "1997",
      thumbnailUrl: "https://coverartarchive.org/release-group/rg-2/front-250",
      imageUrl: "https://coverartarchive.org/release-group/rg-2/front-500",
    };
    vi.mocked(searchCovers).mockResolvedValue([KIND_OF_BLUE, reissue]);
    const { user, dialog, onSubmit } = await renderForm();
    const year = within(dialog).getByLabelText(/^Year/);
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");
    await user.type(within(dialog).getByLabelText("Artist"), "Miles Davis");
    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Kind of Blue 1997 · Miles Davis",
      }),
    );
    expect(year).toHaveValue("1997");
    // Another pick replaces the year the last one filled in.
    await user.click(
      within(dialog).getByRole("button", {
        name: "Kind of Blue 1959 · Miles Davis",
      }),
    );
    expect(year).toHaveValue("1959");
    await user.clear(year);
    await user.type(year, "1958");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Kind of Blue 1997 · Miles Davis",
      }),
    );
    expect(year).toHaveValue("1958");

    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ coverUrl: reissue.imageUrl, year: 1958 }),
    );
  });

  it("says when nothing was found", async () => {
    vi.mocked(searchCovers).mockResolvedValue([]);
    const { user, dialog } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "zzqxv");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );

    expect(await within(dialog).findByText(/no albums found/i)).toBeVisible();
  });

  it("says when none of the covers load", async () => {
    vi.mocked(searchCovers).mockResolvedValue([KIND_OF_BLUE]);
    const { user, dialog } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );
    const cover = await within(dialog).findByRole("button", {
      name: "Kind of Blue 1959 · Miles Davis",
    });
    fireEvent.error(within(cover).getByRole("presentation"));

    expect(
      await within(dialog).findByText(/couldn't load any covers/i),
    ).toBeVisible();
    expect(cover).not.toBeInTheDocument();
  });

  it("says when you're offline", async () => {
    vi.mocked(searchCovers).mockRejectedValue(
      new CoverSearchError("offline", "The browser is offline"),
    );
    const { user, dialog } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );

    expect(await within(dialog).findByText(/you're offline/i)).toBeVisible();
  });

  it("says when MusicBrainz can't be reached", async () => {
    vi.mocked(searchCovers).mockRejectedValue(new Error("503"));
    const { user, dialog } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "Kind of Blue");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );

    expect(
      await within(dialog).findByText(/couldn't reach musicbrainz/i),
    ).toBeVisible();
  });
});
