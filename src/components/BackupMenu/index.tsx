import { useRef } from "react";
import { Button, Dropdown, message } from "antd";
import {
  DownloadOutlined,
  EllipsisOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  albumCount,
  createBackup,
  describeImport,
  InvalidBackupError,
  readBackup,
} from "../../backup";
import { createCsv, InvalidCsvError, readCsv } from "../../csv";
import { Album } from "../../types";

interface BackupMenuProps {
  albums: Album[];
  onImport: (albums: Album[]) => { added: number; skipped: number };
}

function download(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Safari can still be reading the file just after the click.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

// en-CA writes dates as YYYY-MM-DD, in local time.
const today = () => new Date().toLocaleDateString("en-CA");

const isCsv = (file: File) =>
  file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

/** Saves the collection to a file, or adds the albums from one. */
export function BackupMenu({ albums, onImport }: BackupMenuProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    download(
      `album-tracker-backup-${today()}.json`,
      createBackup(albums),
      "application/json",
    );
    messageApi.success(`Exported ${albumCount(albums.length)}.`);
  };

  const exportCsv = () => {
    download(`album-tracker-${today()}.csv`, createCsv(albums), "text/csv");
    messageApi.success(`Exported ${albumCount(albums.length)}.`);
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still triggers a change.
    event.target.value = "";
    if (!file) {
      return;
    }

    let contents: ReturnType<typeof readBackup>;
    try {
      const text = await file.text();
      contents = isCsv(file) ? readCsv(text) : readBackup(text);
    } catch (error) {
      messageApi.error(
        error instanceof InvalidBackupError || error instanceof InvalidCsvError
          ? error.message
          : "Couldn't read that file.",
      );
      return;
    }

    const { added, skipped } = onImport(contents.albums);
    const summary = describeImport({
      added,
      skipped,
      unreadable: contents.unreadable,
    });
    if (added > 0) {
      messageApi.success(summary);
    } else {
      messageApi.info(summary);
    }
  };

  return (
    <>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            {
              key: "export-backup",
              icon: <DownloadOutlined />,
              label: "Export backup",
              disabled: albums.length === 0,
            },
            {
              key: "export-csv",
              icon: <DownloadOutlined />,
              label: "Export as CSV",
              disabled: albums.length === 0,
            },
            {
              key: "import",
              icon: <UploadOutlined />,
              label: "Import backup or CSV",
            },
          ],
          onClick: ({ key }) => {
            if (key === "export-backup") {
              exportBackup();
            } else if (key === "export-csv") {
              exportCsv();
            } else {
              fileInput.current?.click();
            }
          },
        }}
      >
        <Button icon={<EllipsisOutlined />} aria-label="More actions" />
      </Dropdown>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        hidden
        onChange={importFile}
      />
      {messageContextHolder}
    </>
  );
}
