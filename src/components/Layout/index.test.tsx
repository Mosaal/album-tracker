import { render, screen } from "@testing-library/react";
import { Input, Select } from "antd";
import { afterEach, describe, expect, it } from "vitest";

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
});
