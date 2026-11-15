import { Alert, App, Button, Flex } from "antd";

import { exportAlbums } from "../../albumExport";
import { albumCount } from "../../albumFiles";
import { DataSafetyNoticeKind } from "../../hooks";
import { Album } from "../../types";

interface DataSafetyNoticeProps {
  kind: DataSafetyNoticeKind;
  albums: Album[];
  daysSinceExport?: number;
  /** Called after the collection is saved to a file. */
  onExport: () => void;
  onDismiss: () => void;
}

/** A tip or reminder that helps keep the collection from being lost. */
export function DataSafetyNotice({
  kind,
  albums,
  daysSinceExport,
  onExport,
  onDismiss,
}: DataSafetyNoticeProps) {
  const { message } = App.useApp();

  const exportJson = () => {
    exportAlbums(albums, "json");
    onExport();
    message.success(`Exported ${albumCount(albums.length)}.`);
  };

  let title: string;
  let description: string;
  if (kind === "home-screen-tip") {
    title = "Add Album Tracker to your Home Screen";
    description =
      "Your browser can clear the albums saved here if you don't visit for a while, but Home Screen apps keep theirs. Add it from the Share menu.";
    if (albums.length > 0) {
      description +=
        " The app starts empty, so export your albums as JSON and import them there.";
    }
  } else {
    title = "Export a copy of your albums";
    description = `${
      daysSinceExport === undefined
        ? "You haven't exported them yet."
        : `You last exported them ${daysSinceExport} days ago.`
    } They're only saved in this browser, so keep a copy in case its data is cleared.`;
  }

  return (
    <Alert
      type="info"
      showIcon
      title={title}
      description={
        <Flex vertical gap="small" align="flex-start">
          {description}
          <Flex gap="small" wrap>
            {albums.length > 0 && (
              <Button type="primary" size="small" onClick={exportJson}>
                Export as JSON
              </Button>
            )}
            <Button size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          </Flex>
        </Flex>
      }
    />
  );
}
