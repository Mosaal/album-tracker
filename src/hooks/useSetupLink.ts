import { useEffect, useEffectEvent } from "react";
import { message } from "antd";

import { SyncEngine } from "../sync/engine";
import { readSetupCode, readSetupLink } from "../sync/setupCode";

type MessageApi = ReturnType<typeof message.useMessage>[0];

interface LinkProblem {
  type: "info" | "error";
  text: string;
}

/** Why a setup link's code can't be used on this device, if it can't. */
function findProblem(
  code: string,
  engine: SyncEngine,
): LinkProblem | undefined {
  const config = readSetupCode(code);
  if (!config) {
    return { type: "error", text: "That link's setup code couldn't be read." };
  }
  const repo = engine.getConfig()?.repo;
  if (!repo) {
    return undefined;
  }
  return {
    type: "info",
    text:
      repo.toLowerCase() === config.repo.toLowerCase()
        ? `This device already syncs with ${repo}.`
        : `This device already syncs with ${repo}. To use ${config.repo} instead, disconnect it in Sync settings first.`,
  };
}

/**
 * Hands `onCode` the setup code from a link in another device's QR code,
 * whether the link opens the app or reaches it while it's open, as with an
 * app installed on Android. The code holds a token, so it's taken out of the
 * address straight away. When it can't be used here, a message says why.
 */
export function useSetupLink(
  engine: SyncEngine,
  messageApi: MessageApi,
  onCode: (code: string) => void,
) {
  const handleLink = useEffectEvent(() => {
    const code = readSetupLink(window.location.hash);
    if (code === undefined) {
      return;
    }
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", pathname + search);
    const problem = findProblem(code, engine);
    if (problem) {
      messageApi.open({ type: problem.type, content: problem.text });
    } else {
      onCode(code);
    }
  });

  useEffect(() => {
    handleLink();
    const handleHashChange = () => handleLink();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
}
