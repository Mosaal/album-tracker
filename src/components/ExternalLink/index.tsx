import { Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";

/** A link that opens in a new tab, marked as leaving the app. */
export function ExternalLink({
  href,
  children,
}: React.PropsWithChildren<{ href: string }>) {
  return (
    <Typography.Link href={href} target="_blank" rel="noreferrer">
      {children} <ExportOutlined />
    </Typography.Link>
  );
}
