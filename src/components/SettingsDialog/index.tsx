import { Button, Form, Modal, Segmented, Select, Typography } from "antd";

import { FORMAT_OPTIONS } from "../../albums/albumFormats";
import { GridDensity, Settings } from "../../types";

const DENSITY_OPTIONS: { value: GridDensity; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
];

interface SettingsDialogProps {
  open: boolean;
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
  onClose: () => void;
}

/** This device's settings. Each change applies straight away. */
export function SettingsDialog({
  open,
  settings,
  onChange,
  onClose,
}: SettingsDialogProps) {
  return (
    <Modal
      open={open}
      title="Settings"
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Form layout="vertical" component="div">
        <Form.Item
          label="Album grid"
          extra="Compact fits one more album in each row."
        >
          <Segmented<GridDensity>
            options={DENSITY_OPTIONS}
            value={settings.gridDensity}
            onChange={(gridDensity) => onChange({ gridDensity })}
            aria-label="Album grid"
          />
        </Form.Item>
        <Form.Item
          label="Format for new albums"
          htmlFor="settings-default-format"
          extra="New albums start with this format, and you can still change it."
        >
          <Select
            id="settings-default-format"
            options={FORMAT_OPTIONS}
            value={settings.defaultFormat}
            onChange={(defaultFormat) => onChange({ defaultFormat })}
            placeholder="None"
            allowClear
          />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">
        These settings are saved on this device only.
      </Typography.Text>
    </Modal>
  );
}
