import { useState } from "react";
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  message,
  Modal,
  Space,
  Typography,
} from "antd";
import { CopyOutlined, SyncOutlined } from "@ant-design/icons";

import { describeSyncError, SyncEngine, SyncState } from "../../sync/engine";
import { historyUrl, newTokenUrl, repoUrl } from "../../sync/githubLinks";
import { createSetupCode } from "../../sync/setupCode";
import { describeSyncStatus } from "../../sync/syncStatus";
import { ExternalLink } from "../ExternalLink";
import { tokenRules } from "../formRules";

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
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  // Shown to copy by hand when the clipboard can't be used.
  const [setupCode, setSetupCode] = useState<string>();
  const repo = state.repo ?? "";

  const copySetupCode = async () => {
    const config = engine.getConfig();
    if (!config) {
      return;
    }
    const code = createSetupCode(config);
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
        afterClose={() => setSetupCode(undefined)}
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
            {setupCode ? (
              <Input.TextArea
                readOnly
                value={setupCode}
                aria-label="Setup code"
                autoSize
                onFocus={(event) => event.target.select()}
              />
            ) : (
              <Button icon={<CopyOutlined />} onClick={copySetupCode}>
                Copy setup code
              </Button>
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
