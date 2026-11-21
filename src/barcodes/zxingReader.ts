import {
  BarcodeDetector,
  prepareZXingModule,
  purgeZXingModule,
} from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

import { ALBUM_BARCODES, BarcodeReader } from "./barcodeReader";

// Served with the app, rather than from the CDN the library uses by default.
const overrides = {
  locateFile: (path: string, prefix: string) =>
    path.endsWith(".wasm") ? wasmUrl : prefix + path,
};

export async function createZXingReader(): Promise<BarcodeReader> {
  try {
    // Loads the .wasm file now, so a failure shows here rather than going
    // unnoticed on every frame.
    await prepareZXingModule({ overrides, fireImmediately: true });
  } catch (error) {
    // Forgets the failure, so the next scan tries again.
    purgeZXingModule();
    throw error;
  }
  return new BarcodeDetector({ formats: [...ALBUM_BARCODES] });
}
