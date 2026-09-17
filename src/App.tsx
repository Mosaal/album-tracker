import {
  App as AntdApp,
  ConfigProvider,
  Layout,
  Switch,
  theme,
  Typography,
} from "antd";

import { useThemeMode } from "./useThemeMode";

type AppHeaderProps = {
  isDark: boolean;
  onThemeChange: (isDark: boolean) => void;
};

function AppHeader({ isDark, onThemeChange }: AppHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Layout.Header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: token.paddingLG,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      <Typography.Title level={4} style={{ margin: 0 }}>
        Album Tracker
      </Typography.Title>
      <Switch
        checked={isDark}
        onChange={onThemeChange}
        checkedChildren="Dark"
        unCheckedChildren="Light"
        aria-label="Toggle dark theme"
      />
    </Layout.Header>
  );
}

export default function App() {
  const { isDark, setIsDark } = useThemeMode();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <AntdApp>
        <Layout style={{ minHeight: "100vh" }}>
          <AppHeader isDark={isDark} onThemeChange={setIsDark} />
          <Layout.Content style={{ padding: 24 }} />
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}
