import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoverImage } from ".";

const renderCover = () => {
  render(<CoverImage src="https://example.com/cover.jpg" alt="Kind of Blue" />);
  return screen.getByRole("img", { name: "Kind of Blue" });
};

const fades = (cover: HTMLElement) =>
  getComputedStyle(cover).transition !== "none";

describe("CoverImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fades in a cover that takes a while to load", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const cover = renderCover();
    expect(cover).not.toBeVisible();

    now.mockReturnValue(2500);
    fireEvent.load(cover);
    expect(cover).toBeVisible();
    expect(fades(cover)).toBe(true);
  });

  it("shows a cover that loads straight away without a fade", () => {
    const cover = renderCover();
    fireEvent.load(cover);
    expect(cover).toBeVisible();
    expect(fades(cover)).toBe(false);
  });

  it("shows a cover the browser already has straight away", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true,
    );
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      500,
    );
    const cover = renderCover();
    expect(cover).toBeVisible();
    expect(fades(cover)).toBe(false);
  });
});
