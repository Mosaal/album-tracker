import { useLayoutEffect } from "react";
import {
  App as AntdApp,
  ConfigProvider,
  Layout as AntdLayout,
  Space,
  Switch,
  theme,
  Typography,
} from "antd";
import { createStyles } from "antd-style";

import { useThemeMode } from "../../hooks";
import { getThemeConfig } from "../../theme";

export function Layout({ children }: { children?: React.ReactNode }) {
  const { isDark, setIsDark } = useThemeMode();
  return (
    <ConfigProvider theme={getThemeConfig(isDark)}>
      <PageBackground isDark={isDark} />
      <AntdApp>
        <AntdLayout style={{ minHeight: "100vh" }}>
          <Header isDark={isDark} onThemeChange={setIsDark} />
          <AntdLayout.Content style={{ padding: 24 }}>
            {children}
          </AntdLayout.Content>
        </AntdLayout>
      </AntdApp>
    </ConfigProvider>
  );
}

// Mobile browsers show the page's own background around their status bar and
// toolbars, so it has to follow the theme instead of staying the default white.
function PageBackground({ isDark }: { isDark: boolean }) {
  const { token } = theme.useToken();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = isDark ? "dark" : "light";
    root.style.backgroundColor = token.colorBgLayout;
  }, [isDark, token.colorBgLayout]);

  return null;
}

const useHeaderStyles = createStyles(({ token }) => ({
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: token.paddingLG,
    background: token.colorBgContainer,
    borderBottom: `1px solid ${token.colorSplit}`,
  },
}));

interface HeaderProps {
  isDark: boolean;
  onThemeChange: (isDark: boolean) => void;
}

function Header({ isDark, onThemeChange }: HeaderProps) {
  const { token } = theme.useToken();
  const { styles } = useHeaderStyles();

  return (
    <AntdLayout.Header className={styles.header}>
      <Space align="baseline" size="small">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Album Tracker
        </Typography.Title>
        <Typography.Text
          type="secondary"
          style={{ fontSize: token.fontSizeSM }}
        >
          v{__APP_VERSION__}
        </Typography.Text>
      </Space>
      <Switch
        checked={isDark}
        onChange={onThemeChange}
        checkedChildren="Dark"
        unCheckedChildren="Light"
        aria-label="Toggle dark theme"
      />
    </AntdLayout.Header>
  );
}
