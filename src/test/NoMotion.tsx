import { ConfigProvider } from "antd";

/** antd's animations never finish in jsdom, which would leave modals half-open. */
export function NoMotion({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      {children}
    </ConfigProvider>
  );
}
