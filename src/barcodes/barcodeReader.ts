/** Reads the barcodes in a video's current frame. */
export interface BarcodeReader {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

// The barcodes on CDs and records: EAN in most of the world, UPC in North
// America.
export const ALBUM_BARCODES = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

interface NativeBarcodeDetector {
  new (options: { formats: string[] }): BarcodeReader;
  getSupportedFormats(): Promise<string[]>;
}

/**
 * The browser's own barcode reader, where it reads album barcodes, as Chrome
 * on Android does. Otherwise ZXing's, which iPhones need, loaded on first use.
 */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetector })
    .BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(
      (): string[] => [],
    );
    // A UPC-A barcode is an EAN-13 one starting with 0, so a reader without
    // UPC-A still reads it.
    if (supported.includes("ean_13")) {
      return new Native({
        formats: ALBUM_BARCODES.filter((format) => supported.includes(format)),
      });
    }
  }
  const { createZXingReader } = await import("./zxingReader");
  return createZXingReader();
}
