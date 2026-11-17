import { useState } from "react";
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  QRCode,
  Space,
  Typography,
} from "antd";
import { CopyOutlined, QrcodeOutlined, SyncOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { describeSyncError, SyncEngine, SyncState } from "../../sync/engine";
import { historyUrl, newTokenUrl, repoUrl } from "../../sync/githubLinks";
import { createSetupCode } from "../../sync/setupCode";
import { describeSyncStatus } from "../../sync/syncStatus";
import { ExternalLink } from "../ExternalLink";
import { tokenRules } from "../formRules";

const useStyles = createStyles(({ token }) => ({
  // Space between the buttons and the QR code or setup code they show.
  shown: { marginTop: token.marginSM },
}));

interface TokenFormProps {
  engine: SyncEngine;
  repo: string;
  onSaved: () => void;
}

/** Replaces the token, once GitHub accepts the new one. */
function TokenForm({ engine, repo, onSaved }: TokenFormProps) {
  const [form] = Form.useForm<{ token: string }>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const saveToken = async ({ token }: { token: string }) => {
    setIsSaving(true);
    setError(undefined);
    try {
      await engine.changeToken(token.trim());
      form.resetFields();
      onSaved();
    } catch (error) {
      setError(describeSyncError(error, repo));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Form
        form={form}
        name="sync-token"
        layout="vertical"
        requiredMark={false}
        onFinish={saveToken}
      >
        <Form.Item label="New token" htmlFor="sync-token_token">
          <Space.Compact block>
            <Form.Item
              name="token"
              noStyle
              rules={tokenRules("Paste the new token")}
            >
              <Input.Password placeholder="github_pat_…" autoComplete="off" />
            </Form.Item>
            <Button htmlType="submit" loading={isSaving}>
              Save
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
      {error && <Alert type="error" showIcon title={error} />}
    </>
  );
}

interface SyncSettingsDialogProps {
  open: boolean;
  engine: SyncEngine;
  state: SyncState;
  onClose: () => void;
}

/** Syncing's status, setup codes for other devices, the token, and disconnecting. */
export function SyncSettingsDialog({
  open,
  engine,
  state,
  onClose,
}: SyncSettingsDialogProps) {
  const { styles } = useStyles();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  // Shown to copy by hand when the clipboard can't be used.
  const [setupCode, setSetupCode] = useState<string>();
  const [isQrCodeShown, setIsQrCodeShown] = useState(false);
  const repo = state.repo ?? "";

  const getSetupCode = () => {
    const config = engine.getConfig();
    return config && createSetupCode(config);
  };
  const qrCodeValue = isQrCodeShown ? getSetupCode() : undefined;

  const copySetupCode = async () => {
    const code = getSetupCode();
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      messageApi.success("Setup code copied. Paste it on your other device.");
    } catch {
      setSetupCode(code);
    }
  };

  const confirmDisconnect = async () => {
    const confirmed = await modal.confirm({
      title: "Disconnect this device?",
      content: `It stops syncing and forgets the token. Its albums stay on it, and the copy in ${repo} stays as it is.`,
      okText: "Disconnect",
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: "cancel" },
    });
    if (confirmed) {
      engine.disconnect();
      onClose();
      messageApi.info("This device has stopped syncing.");
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Sync settings"
        onCancel={onClose}
        afterClose={() => {
          setSetupCode(undefined);
          setIsQrCodeShown(false);
        }}
        destroyOnHidden
        footer={
          <Flex justify="space-between">
            <Button danger onClick={confirmDisconnect}>
              Disconnect
            </Button>
            <Button type="primary" onClick={onClose}>
              Done
            </Button>
          </Flex>
        }
      >
        <Flex vertical gap="large">
          <Flex vertical gap="small" align="start">
            <Typography.Text>
              Syncing with{" "}
              <ExternalLink href={repoUrl(repo)}>{repo}</ExternalLink>. Every
              change is saved there, so its{" "}
              <ExternalLink href={historyUrl(repo)}>history</ExternalLink> can
              bring back anything.
            </Typography.Text>
            {state.status === "error" ? (
              <Alert type="warning" showIcon title={state.error} />
            ) : (
              <Typography.Text type="secondary" role="status">
                {describeSyncStatus(state)}
              </Typography.Text>
            )}
            <Button
              icon={<SyncOutlined />}
              loading={state.status === "syncing"}
              onClick={() => void engine.syncNow()}
            >
              Sync now
            </Button>
          </Flex>

          <div>
            <Typography.Title level={5}>Other devices</Typography.Title>
            <Typography.Paragraph>
              To sync another device, copy this setup code and paste it there,
              in <em>Sync with GitHub</em> from the ⋯ menu. It includes the
              token, so only paste it on your own devices.
            </Typography.Paragraph>
            <Flex gap="small" wrap>
              {!setupCode && (
                <Button icon={<CopyOutlined />} onClick={copySetupCode}>
                  Copy setup code
                </Button>
              )}
              <Button
                icon={<QrcodeOutlined />}
                onClick={() => setIsQrCodeShown((shown) => !shown)}
              >
                {isQrCodeShown ? "Hide QR code" : "Show QR code"}
              </Button>
            </Flex>
            {qrCodeValue && (
              <Flex
                vertical
                align="center"
                gap="small"
                className={styles.shown}
              >
                <QRCode
                  value={qrCodeValue}
                  type="svg"
                  size={240}
                  // Black on white whatever the theme, as cameras expect.
                  color="#000"
                  bgColor="#fff"
                  // Cameras need a clear margin around the code.
                  style={{ padding: 16 }}
                  errorLevel="L"
                  role="img"
                  aria-label="QR code of the setup code"
                />
                <Typography.Text type="secondary">
                  Scan it with the other device to copy the setup code there.
                </Typography.Text>
              </Flex>
            )}
            {setupCode && (
              <Input.TextArea
                readOnly
                value={setupCode}
                aria-label="Setup code"
                autoSize
                onFocus={(event) => event.target.select()}
                className={styles.shown}
              />
            )}
          </div>

          <div>
            <Typography.Title level={5}>Token</Typography.Title>
            <Typography.Paragraph>
              If GitHub stops accepting the token,{" "}
              <ExternalLink href={newTokenUrl(repo.split("/")[0])}>
                create a new one
              </ExternalLink>{" "}
              for the same repository and save it here.
            </Typography.Paragraph>
            <TokenForm
              engine={engine}
              repo={repo}
              onSaved={() => messageApi.success("Token saved.")}
            />
          </div>
        </Flex>
        {modalContextHolder}
      </Modal>
      {messageContextHolder}
    </>
  );
}
