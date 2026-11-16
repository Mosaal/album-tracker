import { useRef } from "react";
import { Button, Dropdown, message } from "antd";
import {
  CheckSquareOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  GithubOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { albumCount, describeImport } from "../../albumFiles";
import { InvalidCsvError, readCsv } from "../../csv";
import { downloadCsv, downloadJson } from "../../downloads";
import { InvalidJsonError, readJson } from "../../json";
import { Album } from "../../types";

interface MoreActionsMenuProps {
  /** Starts picking albums to change or delete together. */
  onSelectAlbums: () => void;
  /** Whether this device syncs with GitHub, which changes the sync item. */
  isSyncConnected: boolean;
  /** Opens the sync setup, or its settings once connected. */
  onOpenSync: () => void;
  albums: Album[];
  onImport: (albums: Album[]) => { added: number; skipped: number };
}

const isCsv = (file: File) =>
  file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

/**
 * The ⋯ menu: select albums, sync with GitHub, save the collection to a file,
 * or add albums from one.
 */
export function MoreActionsMenu({
  albums,
  onImport,
  onSelectAlbums,
  isSyncConnected,
  onOpenSync,
}: MoreActionsMenuProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    downloadJson(albums);
    messageApi.success(`Exported ${albumCount(albums.length)}.`);
  };

  const exportCsv = () => {
    downloadCsv(albums);
    messageApi.success(`Exported ${albumCount(albums.length)}.`);
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still triggers a change.
    event.target.value = "";
    if (!file) {
      return;
    }

    let contents: ReturnType<typeof readJson>;
    try {
      const text = await file.text();
      contents = isCsv(file) ? readCsv(text) : readJson(text);
    } catch (error) {
      messageApi.error(
        error instanceof InvalidJsonError || error instanceof InvalidCsvError
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
              key: "select",
              icon: <CheckSquareOutlined />,
              label: "Select albums",
              disabled: albums.length === 0,
            },
            {
              key: "sync",
              icon: <GithubOutlined />,
              label: isSyncConnected ? "Sync settings…" : "Sync with GitHub…",
            },
            { type: "divider" },
            {
              key: "export-json",
              icon: <DownloadOutlined />,
              label: "Export as JSON",
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
              label: "Import JSON or CSV",
            },
          ],
          onClick: ({ key }) => {
            if (key === "select") {
              onSelectAlbums();
            } else if (key === "sync") {
              onOpenSync();
            } else if (key === "export-json") {
              exportJson();
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
