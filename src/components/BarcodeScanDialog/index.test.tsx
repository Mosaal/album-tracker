import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BarcodeAlbum, lookUpBarcode } from "../../api/barcodeLookup";
import { MusicBrainzError } from "../../api/musicBrainz";
import { createBarcodeReader } from "../../barcodes/barcodeReader";
import { NoMotion } from "../../test/NoMotion";
import { AlbumFormModal } from "../AlbumFormModal";

vi.mock("../../api/barcodeLookup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/barcodeLookup")>()),
  lookUpBarcode: vi.fn(),
}));
vi.mock("../../barcodes/barcodeReader", () => ({
  createBarcodeReader: vi.fn(),
}));

const OK_COMPUTER: BarcodeAlbum = {
  title: "OK Computer",
  artist: "Radiohead",
  year: 1997,
  format: "cd",
  coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
};

const getUserMedia = vi.fn<MediaDevices["getUserMedia"]>();

const noCamera = (name: string) => new DOMException("No camera", name);

/** A camera, as far as the dialog can tell, and its one video track. */
function fakeCamera() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

// The scanner opens over the album form, and antd's animations for a dialog
// over a dialog don't reliably finish in jsdom, so what's in it is checked for
// being there rather than visible.
const findScanner = () =>
  waitFor(() => {
    const scanner = screen
      .getAllByRole("dialog")
      .find(
        (dialog) =>
          dialog.querySelector(".ant-modal-title")?.textContent ===
          "Scan a barcode",
      );
    expect(scanner).toBeDefined();
    return scanner!;
  });

async function openForm() {
  const onSubmit = vi.fn();
  render(
    <AlbumFormModal open albums={[]} onSubmit={onSubmit} onCancel={vi.fn()} />,
    { wrapper: NoMotion },
  );
  const user = userEvent.setup();
  const form = await screen.findByRole("dialog");
  await user.click(
    within(form).getByRole("button", { name: /scan a barcode/i }),
  );
  return { user, form, onSubmit };
}

async function openScanner() {
  const opened = await openForm();
  return { ...opened, scanner: await findScanner() };
}

async function typeBarcode(
  user: ReturnType<typeof userEvent.setup>,
  scanner: HTMLElement,
  barcode: string,
) {
  const input = within(scanner).getByRole("textbox", {
    name: "Barcode number",
  });
  await user.clear(input);
  await user.type(input, barcode);
  await user.click(within(scanner).getByRole("button", { name: "Look up" }));
}

describe("scanning a barcode in the album form", () => {
  beforeEach(() => {
    vi.mocked(lookUpBarcode).mockReset();
    vi.mocked(createBarcodeReader).mockReset();
    getUserMedia.mockReset();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
  });

  it("fills in the album from the number under the barcode", async () => {
    getUserMedia.mockRejectedValue(noCamera("NotFoundError"));
    vi.mocked(lookUpBarcode).mockResolvedValue(OK_COMPUTER);
    const { user, form, scanner, onSubmit } = await openScanner();
    expect(
      await within(scanner).findByText(
        "There's no camera to use. You can type the number under the barcode instead.",
      ),
    ).toBeInTheDocument();

    await typeBarcode(user, scanner, "1234567");
    expect(
      within(scanner).getByText("Enter the 8 to 14 digits under the barcode"),
    ).toBeInTheDocument();
    await typeBarcode(user, scanner, "0 724385 52292 5");

    expect(lookUpBarcode).toHaveBeenCalledWith(
      "0724385522925",
      expect.any(AbortSignal),
    );
    await waitFor(() => expect(scanner).not.toBeVisible());
    expect(within(form).getByLabelText("Title")).toHaveValue("OK Computer");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledWith({
      ...OK_COMPUTER,
      status: "owned",
    });
  });

  it("reads a barcode with the camera, and stops the camera once the album's found", async () => {
    const { stream, track } = fakeCamera();
    getUserMedia.mockResolvedValue(stream);
    vi.mocked(createBarcodeReader).mockResolvedValue({
      detect: vi.fn().mockResolvedValue([{ rawValue: "724385522925" }]),
    });
    vi.mocked(lookUpBarcode).mockResolvedValue(OK_COMPUTER);
    // The camera reads it at once, so the scanner may close before it's seen.
    const { form } = await openForm();

    await waitFor(() =>
      expect(within(form).getByLabelText("Artist")).toHaveValue("Radiohead"),
    );
    expect(lookUpBarcode).toHaveBeenCalledWith(
      "724385522925",
      expect.any(AbortSignal),
    );
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          facingMode: { ideal: "environment" },
        }),
      }),
    );
    expect(track.stop).toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "Barcode number" }),
    ).toBeNull();
  });

  it("says when the camera isn't allowed, or MusicBrainz has no album with the barcode", async () => {
    getUserMedia.mockRejectedValue(noCamera("NotAllowedError"));
    vi.mocked(lookUpBarcode).mockResolvedValue(undefined);
    const { user, scanner } = await openScanner();
    expect(
      await within(scanner).findByText(/isn't allowed to use the camera/),
    ).toBeInTheDocument();

    await typeBarcode(user, scanner, "5012345678900");

    expect(
      await within(scanner).findByText(
        "MusicBrainz has no album with the barcode 5012345678900. Try another, or fill it in yourself.",
      ),
    ).toBeInTheDocument();
  });

  it("tries again after MusicBrainz couldn't be reached", async () => {
    getUserMedia.mockRejectedValue(noCamera("NotFoundError"));
    vi.mocked(lookUpBarcode)
      .mockRejectedValueOnce(
        new MusicBrainzError("offline", "The browser is offline"),
      )
      .mockResolvedValueOnce(OK_COMPUTER);
    const { user, form, scanner } = await openScanner();

    await typeBarcode(user, scanner, "0724385522925");
    expect(
      await within(scanner).findByText(
        "You're offline. Look it up once you're connected.",
      ),
    ).toBeInTheDocument();
    await user.click(
      within(scanner).getByRole("button", { name: "Try again" }),
    );

    await waitFor(() => expect(scanner).not.toBeVisible());
    expect(lookUpBarcode).toHaveBeenLastCalledWith(
      "0724385522925",
      expect.any(AbortSignal),
    );
    expect(within(form).getByLabelText("Title")).toHaveValue("OK Computer");
  });

  it("is only offered when adding an album", async () => {
    render(
      <AlbumFormModal
        open
        album={{ id: "1", ...OK_COMPUTER, status: "owned" }}
        albums={[]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper: NoMotion },
    );

    const form = await screen.findByRole("dialog");
    expect(
      within(form).queryByRole("button", { name: /scan a barcode/i }),
    ).toBeNull();
  });
});
