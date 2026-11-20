import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Flex,
  Input,
  Modal,
  Space,
  Spin,
  Typography,
} from "antd";
import { createStyles } from "antd-style";

import {
  BarcodeAlbum,
  lookUpBarcode,
  toBarcode,
} from "../../api/barcodeLookup";
import { MusicBrainzError } from "../../api/musicBrainz";
import { BarcodeReader, createBarcodeReader } from "../../barcodeReader";

// Often enough to feel instant, without keeping a phone's processor busy.
const SCAN_INTERVAL_MS = 250;

const useStyles = createStyles(({ token }) => ({
  viewfinder: {
    position: "relative",
    overflow: "hidden",
    borderRadius: token.borderRadiusLG,
    background: "#000",
  },
  video: {
    display: "block",
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
  },
  // Shows where to hold the barcode.
  guide: {
    position: "absolute",
    inset: "32% 12%",
    border: "2px solid rgba(255, 255, 255, 0.85)",
    borderRadius: token.borderRadius,
    boxShadow: "0 0 0 100vmax rgba(0, 0, 0, 0.35)",
  },
}));

type Camera =
  | { status: "starting" | "scanning" }
  | { status: "unavailable"; message: string };

type Lookup =
  | { status: "idle" }
  | { status: "looking" | "notFound"; barcode: string }
  | { status: "error"; barcode: string; reason: MusicBrainzError["reason"] };

const TYPE_IT = "type the number under the barcode instead";

function describeCameraError(error: unknown) {
  switch (error instanceof DOMException ? error.name : "") {
    case "NotAllowedError":
    case "SecurityError":
      return `Album Tracker isn't allowed to use the camera. Allow it in your browser's settings, or ${TYPE_IT}.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `There's no camera to use. You can ${TYPE_IT}.`;
    case "NotReadableError":
      return `Another app is using the camera. Close it and try again, or ${TYPE_IT}.`;
    default:
      return `Couldn't start the camera. You can ${TYPE_IT}.`;
  }
}

const stopCamera = (stream?: MediaStream) =>
  stream?.getTracks().forEach((track) => track.stop());

// Pages that aren't served securely have no camera, whatever the types say.
const canUseCamera = () =>
  Boolean((navigator.mediaDevices as MediaDevices | undefined)?.getUserMedia);

interface ScanPanelProps {
  onFound: (album: BarcodeAlbum) => void;
}

/** The camera and the typed number. Mounted only while the dialog is open. */
function ScanPanel({ onFound }: ScanPanelProps) {
  const { styles } = useStyles();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>(() =>
    canUseCamera()
      ? { status: "starting" }
      : {
          status: "unavailable",
          message: `This browser can't use the camera here. You can ${TYPE_IT}.`,
        },
  );
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string>();
  const controllerRef = useRef<AbortController>(null);
  // The barcode looked up last, so one still in view isn't looked up again.
  const lastBarcodeRef = useRef<string>(null);
  const onFoundRef = useRef(onFound);

  useEffect(() => {
    onFoundRef.current = onFound;
  }, [onFound]);

  const lookUp = useCallback(async (barcode: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    lastBarcodeRef.current = barcode;
    setLookup({ status: "looking", barcode });
    try {
      const album = await lookUpBarcode(barcode, controller.signal);
      if (album) {
        onFoundRef.current(album);
      } else {
        setLookup({ status: "notFound", barcode });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setLookup({
          status: "error",
          barcode,
          reason:
            error instanceof MusicBrainzError ? error.reason : "unavailable",
        });
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!canUseCamera()) {
      return;
    }
    let isStopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scan = async (reader: BarcodeReader) => {
      const video = videoRef.current;
      if (video && !controllerRef.current) {
        try {
          const barcode = (await reader.detect(video))
            .map(({ rawValue }) => toBarcode(rawValue))
            .find((code) => code && code !== lastBarcodeRef.current);
          if (barcode && !isStopped) {
            void lookUp(barcode);
          }
        } catch {
          // A frame that isn't ready yet: try the next one.
        }
      }
      if (!isStopped) {
        timer = setTimeout(() => void scan(reader), SCAN_INTERVAL_MS);
      }
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (error) {
        if (!isStopped) {
          setCamera({
            status: "unavailable",
            message: describeCameraError(error),
          });
        }
        return;
      }
      const video = videoRef.current;
      if (isStopped || !video) {
        stopCamera(stream);
        return;
      }
      video.srcObject = stream;
      // Muted and inline, so phones let it play without a tap.
      void video.play()?.catch(() => {});

      let reader: BarcodeReader;
      try {
        reader = await createBarcodeReader();
      } catch {
        stopCamera(stream);
        if (!isStopped) {
          setCamera({
            status: "unavailable",
            message: `Couldn't load the barcode reader. Check your connection, or ${TYPE_IT}.`,
          });
        }
        return;
      }
      if (!isStopped) {
        setCamera({ status: "scanning" });
        void scan(reader);
      }
    };

    void start();
    return () => {
      isStopped = true;
      clearTimeout(timer);
      stopCamera(stream);
    };
  }, [lookUp]);

  // A lookup still running when the dialog closes is cancelled.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const lookUpTyped = () => {
    const barcode = toBarcode(typed);
    setTypedError(
      barcode ? undefined : "Enter the 8 to 14 digits under the barcode",
    );
    if (barcode) {
      void lookUp(barcode);
    }
  };

  let status: React.ReactNode = null;
  if (lookup.status === "looking") {
    status = (
      <Space>
        <Spin size="small" />
        Looking up {lookup.barcode} on MusicBrainz…
      </Space>
    );
  } else if (lookup.status === "notFound") {
    status = (
      <Typography.Text type="warning">
        MusicBrainz has no album with the barcode {lookup.barcode}. Try another,
        or fill it in yourself.
      </Typography.Text>
    );
  } else if (lookup.status === "error") {
    const { barcode } = lookup;
    status = (
      <Space wrap>
        <Typography.Text type="danger">
          {lookup.reason === "offline"
            ? "You're offline. Look it up once you're connected."
            : "Couldn't reach MusicBrainz. Try again in a moment."}
        </Typography.Text>
        <Button size="small" onClick={() => void lookUp(barcode)}>
          Try again
        </Button>
      </Space>
    );
  } else if (camera.status === "starting") {
    status = "Starting the camera…";
  } else if (camera.status === "scanning") {
    status = "Hold the barcode inside the frame.";
  }

  return (
    <Flex vertical gap="middle">
      {camera.status === "unavailable" ? (
        <Alert type="info" showIcon title={camera.message} />
      ) : (
        <div className={styles.viewfinder}>
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            muted
            playsInline
            aria-label="Camera"
          />
          <div className={styles.guide} />
        </div>
      )}
      <div role="status">{status}</div>
      <Flex vertical gap="small">
        <Typography.Text>Or type the number under the barcode:</Typography.Text>
        <Space.Compact block>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onPressEnter={lookUpTyped}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0724385522925"
            aria-label="Barcode number"
            status={typedError ? "error" : undefined}
          />
          <Button onClick={lookUpTyped}>Look up</Button>
        </Space.Compact>
        {typedError && (
          <Typography.Text type="danger">{typedError}</Typography.Text>
        )}
      </Flex>
    </Flex>
  );
}

interface BarcodeScanDialogProps {
  open: boolean;
  /** Called with the album MusicBrainz has for the barcode scanned. */
  onFound: (album: BarcodeAlbum) => void;
  onCancel: () => void;
}

/**
 * Reads an album's barcode with the camera, or as typed, and looks it up on
 * MusicBrainz. The camera only runs while the dialog is open.
 */
export function BarcodeScanDialog({
  open,
  onFound,
  onCancel,
}: BarcodeScanDialogProps) {
  return (
    <Modal
      open={open}
      title="Scan a barcode"
      onCancel={onCancel}
      footer={(_, { CancelBtn }) => <CancelBtn />}
      // Unmounting the panel stops the camera.
      destroyOnHidden
    >
      <ScanPanel onFound={onFound} />
    </Modal>
  );
}
