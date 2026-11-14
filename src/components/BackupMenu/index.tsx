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
import { Album } from "../../types";

interface BackupMenuProps {
  albums: Album[];
  onImport: (albums: Album[]) => { added: number; skipped: number };
}

function download(fileName: string, contents: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Safari can still be reading the file just after the click.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

/** Saves the collection to a file, or adds the albums from one. */
export function BackupMenu({ albums, onImport }: BackupMenuProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    // en-CA writes dates as YYYY-MM-DD, in local time.
    const date = new Date().toLocaleDateString("en-CA");
    download(`album-tracker-backup-${date}.json`, createBackup(albums));
    messageApi.success(`Exported ${albumCount(albums.length)}.`);
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still triggers a change.
    event.target.value = "";
    if (!file) {
      return;
    }

    let backup: ReturnType<typeof readBackup>;
    try {
      backup = readBackup(await file.text());
    } catch (error) {
      messageApi.error(
        error instanceof InvalidBackupError
          ? error.message
          : "Couldn't read that file.",
      );
      return;
    }

    const { added, skipped } = onImport(backup.albums);
    const summary = describeImport({
      added,
      skipped,
      unreadable: backup.unreadable,
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
              key: "export",
              icon: <DownloadOutlined />,
              label: "Export backup",
              disabled: albums.length === 0,
            },
            { key: "import", icon: <UploadOutlined />, label: "Import backup" },
          ],
          onClick: ({ key }) =>
            key === "export" ? exportBackup() : fileInput.current?.click(),
        }}
      >
        <Button icon={<EllipsisOutlined />} aria-label="More actions" />
      </Dropdown>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importBackup}
      />
      {messageContextHolder}
    </>
  );
}
