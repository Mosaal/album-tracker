import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CoverResult, searchCovers } from "../../api/coverArt";
import { NoMotion } from "../../test/NoMotion";
import { AlbumFormModal } from "../AlbumFormModal";

vi.mock("../../api/coverArt", () => ({ searchCovers: vi.fn() }));

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
  render(<AlbumFormModal open onSubmit={onSubmit} onCancel={vi.fn()} />, {
    wrapper: NoMotion,
  });
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

  it("says when nothing was found", async () => {
    vi.mocked(searchCovers).mockResolvedValue([]);
    const { user, dialog } = await renderForm();
    await user.type(within(dialog).getByLabelText("Title"), "zzqxv");

    await user.click(
      within(dialog).getByRole("button", { name: /find covers/i }),
    );

    expect(await within(dialog).findByText(/no covers found/i)).toBeVisible();
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
