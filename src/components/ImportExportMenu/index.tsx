import { useRef } from "react";
import { Button, Dropdown, message } from "antd";
import {
  DownloadOutlined,
  EllipsisOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { exportAlbums, ExportFormat } from "../../albumExport";
import { albumCount, describeImport } from "../../albumFiles";
import { InvalidCsvError, readCsv } from "../../csv";
import { InvalidJsonError, readJson } from "../../json";
import { Album } from "../../types";

interface ImportExportMenuProps {
  albums: Album[];
  onImport: (albums: Album[]) => { added: number; skipped: number };
  /** Called after the collection is saved to a file. */
  onExport: () => void;
}

const isCsv = (file: File) =>
  file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

/** Saves the collection to a file, or adds the albums from one. */
export function ImportExportMenu({
  albums,
  onImport,
  onExport,
}: ImportExportMenuProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportAs = (format: ExportFormat) => {
    exportAlbums(albums, format);
    onExport();
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
            if (key === "export-json") {
              exportAs("json");
            } else if (key === "export-csv") {
              exportAs("csv");
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
