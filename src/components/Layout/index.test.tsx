import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, Select } from "antd";
import { afterEach, describe, expect, it } from "vitest";

import { NoMotion } from "../../test/NoMotion";
import { Layout } from ".";

const realMatchMedia = window.matchMedia;

/** The font size of each kind of field, on a touch screen or with a mouse. */
function fieldFontSizes(isTouch: boolean) {
  window.matchMedia = (query) => ({
    ...realMatchMedia(query),
    matches: isTouch && query === "(pointer: coarse)",
  });
  render(
    <Layout>
      <Input aria-label="Title" />
      <Input.Password aria-label="Token" />
      <Input.TextArea aria-label="Setup code" />
      <Select aria-label="Format" options={[{ value: "cd", label: "CD" }]} />
    </Layout>,
  );
  return ["Title", "Token", "Setup code", "Format"].map(
    (name) => getComputedStyle(screen.getByLabelText(name)).fontSize,
  );
}

describe("Layout", () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  // iOS zooms in on a field with text smaller than 16px when it's focused.
  it("gives every field 16px text on a touch screen, so iOS doesn't zoom in", () => {
    expect(fieldFontSizes(true)).toEqual(["16px", "16px", "16px", "16px"]);
  });

  it("keeps the usual 14px text with a mouse", () => {
    expect(fieldFontSizes(false)).toEqual(["14px", "14px", "14px", "14px"]);
  });

  it("lets you pick a light, dark or system theme, and starts with the system's", async () => {
    window.matchMedia = (query) => ({
      ...realMatchMedia(query),
      matches: query === "(prefers-color-scheme: dark)",
    });
    const user = userEvent.setup();
    render(<Layout />, { wrapper: NoMotion });
    const shownTheme = () => document.documentElement.dataset.theme;
    const savedTheme = () => localStorage.getItem("album-tracker:theme");
    expect(shownTheme()).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Theme: System" }));
    await user.click(await screen.findByRole("menuitem", { name: /light/i }));
    expect(shownTheme()).toBe("light");
    expect(savedTheme()).toBe("light");

    await user.click(screen.getByRole("button", { name: "Theme: Light" }));
    await user.click(await screen.findByRole("menuitem", { name: /system/i }));
    expect(shownTheme()).toBe("dark");
    expect(savedTheme()).toBeNull();
  });
});
