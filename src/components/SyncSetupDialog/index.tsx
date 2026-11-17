import { useState } from "react";
import { Alert, Button, Form, Input, Modal, Tabs, Typography } from "antd";
import { createStyles } from "antd-style";

import { albumCount, findDuplicate } from "../../albumFiles";
import { GitHubError, parseRepo } from "../../api/github";
import { downloadJson } from "../../downloads";
import { SyncConfig } from "../../sync/config";
import { describeSyncError, SyncEngine } from "../../sync/engine";
import { NEW_REPO_URL, newTokenUrl } from "../../sync/githubLinks";
import { readSetupCode } from "../../sync/setupCode";
import { Album, Collection } from "../../types";
import { ExternalLink } from "../ExternalLink";
import { tokenRules, validateWith } from "../formRules";

const useStyles = createStyles(({ token }) => ({
  steps: { margin: 0, paddingInlineStart: token.paddingLG },
}));

type SetupMethod = "new" | "code";

interface SetupValues {
  repo?: string;
  token?: string;
  code?: string;
}

/** Links to GitHub's token form, filled in for the repository's owner. */
function NewTokenLink() {
  const repo = Form.useWatch<string | undefined>("repo");
  const owner = parseRepo(repo ?? "")?.split("/")[0];
  return <ExternalLink href={newTokenUrl(owner)}>Create a token</ExternalLink>;
}

function NewSetupFields() {
  const { styles } = useStyles();
  return (
    <ol className={styles.steps}>
      <li>
        <Typography.Paragraph>
          Create a private repository on GitHub to keep your collection in.{" "}
          <ExternalLink href={NEW_REPO_URL}>Create a repository</ExternalLink>
        </Typography.Paragraph>
        <Form.Item
          name="repo"
          label="Repository"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "Enter the repository",
            },
            {
              validator: validateWith(
                (value) => parseRepo(value) !== undefined,
                "Enter it as owner/name, like your-name/album-collection",
              ),
            },
          ]}
        >
          <Input
            placeholder="your-name/album-collection"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Form.Item>
      </li>
      <li>
        <Typography.Paragraph>
          Create a token that lets Album Tracker save to it. <NewTokenLink />{" "}
          The link fills in the details, except one: under{" "}
          <em>Repository access</em>, choose <em>Only select repositories</em>{" "}
          and pick your repository.
        </Typography.Paragraph>
        <Form.Item
          name="token"
          label="Token"
          rules={tokenRules("Paste the token")}
        >
          <Input.Password placeholder="github_pat_…" autoComplete="off" />
        </Form.Item>
      </li>
    </ol>
  );
}

function SetupCodeField() {
  return (
    <>
      <Typography.Paragraph>
        On a device that's already syncing, open <em>Sync settings</em> from the
        ⋯ menu. Scan its QR code with this device's camera, or copy its setup
        code and paste it here.
      </Typography.Paragraph>
      <Form.Item
        name="code"
        label="Setup code"
        rules={[
          { required: true, whitespace: true, message: "Paste the setup code" },
          {
            validator: validateWith(
              (value) => readSetupCode(value) !== undefined,
              "That isn't a setup code from Album Tracker",
            ),
          },
        ]}
      >
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          autoComplete="off"
          spellCheck={false}
        />
      </Form.Item>
    </>
  );
}

interface SyncSetupDialogProps {
  open: boolean;
  engine: SyncEngine;
  /** This device's albums, which a repository's albums replace. */
  albums: Album[];
  /** A setup code to start with, from a link in another device's QR code. */
  initialCode?: string;
  onConnected: (repo: string) => void;
  onCancel: () => void;
}

/** Connects this device to a GitHub repository, to sync with other devices. */
export function SyncSetupDialog({
  open,
  engine,
  albums,
  initialCode,
  onConnected,
  onCancel,
}: SyncSetupDialogProps) {
  const [chosenMethod, setChosenMethod] = useState<SetupMethod>();
  const method = chosenMethod ?? (initialCode ? "code" : "new");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string>();
  const [modal, modalContextHolder] = Modal.useModal();

  const confirmPublic = (repo: string) =>
    modal.confirm({
      title: "Use a public repository?",
      content: `Anyone can see ${repo}, so they could see your collection too. You can make it private in its settings on GitHub.`,
      okText: "Use it anyway",
      focusable: { autoFocusButton: "cancel" },
    });

  const confirmReplace = (
    repo: string,
    collection: Collection,
    onlyHere: number,
  ) =>
    modal.confirm({
      title: "Replace this device's albums?",
      content: `This device's ${albumCount(albums.length)} will be replaced by the ${albumCount(collection.albums.length)} in ${repo}. ${
        onlyHere === 1
          ? "One of them isn't there, so export a copy first to keep it."
          : `${onlyHere} of them aren't there, so export a copy first to keep them.`
      }`,
      okText: "Replace",
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: "cancel" },
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <Button onClick={() => downloadJson(albums)}>Export first</Button>
          <CancelBtn />
          <OkBtn />
        </>
      ),
    });

  async function connect(config: SyncConfig) {
    setIsConnecting(true);
    setError(undefined);
    try {
      const checked = await engine.check(config);
      if (!checked.isPrivate && !(await confirmPublic(checked.repo))) {
        return;
      }
      const { collection } = checked;
      if (collection) {
        const onlyHere = albums.filter(
          (album) =>
            !collection.albums.some(({ id }) => id === album.id) &&
            !findDuplicate(collection.albums, album),
        ).length;
        if (
          onlyHere > 0 &&
          !(await confirmReplace(checked.repo, collection, onlyHere))
        ) {
          return;
        }
      }
      await engine.connect(checked, config.token);
      onConnected(checked.repo);
    } catch (error) {
      setError(
        error instanceof GitHubError && error.reason === "conflict"
          ? `Another device just started syncing with ${config.repo}. Connect again to use its albums.`
          : describeSyncError(error, config.repo),
      );
    } finally {
      setIsConnecting(false);
    }
  }

  const handleFinish = ({ repo = "", token = "", code = "" }: SetupValues) => {
    const config =
      method === "code"
        ? readSetupCode(code)
        : { repo: parseRepo(repo) ?? "", token: token.trim() };
    if (config) {
      void connect(config);
    }
  };

  return (
    <Modal
      open={open}
      title="Sync with GitHub"
      onCancel={onCancel}
      afterClose={() => {
        setChosenMethod(undefined);
        setError(undefined);
      }}
      // Stray clicks or keys shouldn't throw away a half-filled form, or
      // close the dialog while it's connecting.
      mask={{ closable: false }}
      keyboard={!isConnecting}
      closable={!isConnecting}
      destroyOnHidden
      footer={(_, { CancelBtn }) => (
        <>
          <CancelBtn />
          <Button type="primary" htmlType="submit" loading={isConnecting}>
            Connect
          </Button>
        </>
      )}
      cancelButtonProps={{ disabled: isConnecting }}
      // Wrap the whole dialog so the Connect button (and Enter) submits.
      modalRender={(dialog) => (
        <Form<SetupValues>
          name="sync-setup"
          layout="vertical"
          requiredMark={false}
          initialValues={{ code: initialCode }}
          onFinish={handleFinish}
        >
          {dialog}
        </Form>
      )}
    >
      <Typography.Paragraph>
        Keep your collection in a GitHub repository of your own, and connect
        each of your devices to it. If the repository already has albums, they
        replace the ones on this device.
      </Typography.Paragraph>
      <Tabs
        activeKey={method}
        onChange={(key) => {
          setChosenMethod(key as SetupMethod);
          setError(undefined);
        }}
        items={[
          { key: "new", label: "New setup" },
          { key: "code", label: "Setup code" },
        ]}
      />
      {method === "new" ? <NewSetupFields /> : <SetupCodeField />}
      {error && <Alert type="error" showIcon title={error} />}
      {modalContextHolder}
    </Modal>
  );
}
