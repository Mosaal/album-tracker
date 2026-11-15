import { vi } from "vitest";

/** Catches downloads, returning the spy on the link that's clicked. */
export function mockDownloads() {
  URL.createObjectURL = vi.fn(() => "blob:download");
  URL.revokeObjectURL = vi.fn();
  return vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
}

/** The contents of the first file downloaded since mockDownloads. */
export const downloadedText = () =>
  (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).text();
