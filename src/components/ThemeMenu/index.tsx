import { Button, Dropdown } from "antd";
import { DesktopOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";

import { ThemeMode } from "../../hooks";

const MODES: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { key: "light", label: "Light", icon: <SunOutlined /> },
  { key: "dark", label: "Dark", icon: <MoonOutlined /> },
  { key: "system", label: "System", icon: <DesktopOutlined /> },
];

interface ThemeMenuProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/** Picks a light or dark theme, or the system's, from a button in the header. */
export function ThemeMenu({ mode, onChange }: ThemeMenuProps) {
  const current = MODES.find(({ key }) => key === mode)!;

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: MODES,
        selectable: true,
        selectedKeys: [mode],
        onClick: ({ key }) => onChange(key as ThemeMode),
      }}
    >
      <Button
        type="text"
        shape="circle"
        icon={current.icon}
        aria-label={`Theme: ${current.label}`}
      />
    </Dropdown>
  );
}
