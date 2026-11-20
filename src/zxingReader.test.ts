import { ZXING_WASM_VERSION } from "barcode-detector/ponyfill";
import { expect, it } from "vitest";

import pkg from "../package.json";

// zxingReader.ts serves the app's own copy of ZXing's .wasm file, which only
// works with the version of ZXing the barcode reader was built for.
it("depends on the version of ZXing the barcode reader was built for", () => {
  expect(pkg.dependencies["zxing-wasm"]).toBe(ZXING_WASM_VERSION);
});
