import { Button, theme, Tooltip } from "antd";
import {
  CloudOutlined,
  CloudUploadOutlined,
  DisconnectOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { SyncState, SyncStatus } from "../../sync/engine";
import { describeSyncStatus } from "../../sync/syncStatus";

const ICONS: Record<Exclude<SyncStatus, "disconnected">, React.ReactNode> = {
  syncing: <SyncOutlined spin />,
  synced: <CloudOutlined />,
  pending: <CloudUploadOutlined />,
  offline: <DisconnectOutlined />,
  error: <WarningOutlined />,
};

interface SyncStatusButtonProps {
  state: SyncState;
  /** Opens the sync settings. */
  onClick: () => void;
}

/** Shows how syncing is going, in the header, while it's on. */
export function SyncStatusButton({ state, onClick }: SyncStatusButtonProps) {
  const { token } = theme.useToken();
  if (state.status === "disconnected") {
    return null;
  }

  const description = describeSyncStatus(state);
  return (
    <Tooltip title={description}>
      <Button
        type="text"
        shape="circle"
        icon={ICONS[state.status]}
        style={
          state.status === "error" ? { color: token.colorWarning } : undefined
        }
        aria-label={`GitHub sync: ${description}`}
        onClick={onClick}
      />
    </Tooltip>
  );
}
