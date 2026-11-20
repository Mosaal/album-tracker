import { afterEach, describe, expect, it, vi } from "vitest";

import { createBarcodeReader } from "./barcodeReader";
import { createZXingReader } from "./zxingReader";

vi.mock("./zxingReader", () => ({
  createZXingReader: vi.fn(() => ({ detect: vi.fn(), isZXing: true })),
}));

/** A browser's own barcode reader, which reads the formats given. */
function nativeReader(supported: string[]) {
  return class {
    static getSupportedFormats = () => Promise.resolve(supported);
    constructor(readonly options: { formats: string[] }) {}
    detect = vi.fn();
  };
}

describe("createBarcodeReader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(createZXingReader).mockClear();
  });

  it("uses the browser's own reader for the album barcodes it reads", async () => {
    vi.stubGlobal(
      "BarcodeDetector",
      nativeReader(["qr_code", "ean_13", "ean_8", "upc_e"]),
    );

    const reader = await createBarcodeReader();

    expect(reader).toMatchObject({
      options: { formats: ["ean_13", "ean_8", "upc_e"] },
    });
    expect(createZXingReader).not.toHaveBeenCalled();
  });

  it.each([
    ["can't read EAN-13 barcodes", nativeReader(["qr_code", "code_128"])],
    ["has no barcode reader", undefined],
  ])("uses ZXing's when the browser %s", async (_, BarcodeDetector) => {
    vi.stubGlobal("BarcodeDetector", BarcodeDetector);

    await expect(createBarcodeReader()).resolves.toMatchObject({
      isZXing: true,
    });
  });
});
