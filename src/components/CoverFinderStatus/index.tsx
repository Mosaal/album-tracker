import { useSyncExternalStore } from "react";
import { Button, Flex, Popover, theme, Typography } from "antd";

import { albumCount } from "../../albums/albumFiles";
import { CoverFinder } from "../../covers/coverFinder";

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How much is done, as a ring. Drawn here rather than with antd's Progress,
 * which would add to the main bundle.
 */
function ProgressRing({ done }: { done: number }) {
  const { token } = theme.useToken();
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle
        cx="9"
        cy="9"
        r={RADIUS}
        fill="none"
        stroke={token.colorFillSecondary}
        strokeWidth="2.5"
      />
      <circle
        cx="9"
        cy="9"
        r={RADIUS}
        fill="none"
        stroke={token.colorPrimary}
        strokeWidth="2.5"
        strokeDasharray={`${done * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        // Starts at the top, going clockwise.
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/**
 * Shows how finding covers is going, in the header, while it is. Clicking it
 * says more, and offers to stop.
 */
export function CoverFinderStatus({ finder }: { finder: CoverFinder }) {
  const { isFinding, isWaiting, done, total, found } = useSyncExternalStore(
    finder.subscribe,
    finder.getState,
  );
  if (!isFinding) {
    return null;
  }

  const description = `${isWaiting ? "Finding covers, waiting for MusicBrainz, which is busy" : "Finding covers"}: ${done.toLocaleString()} of ${albumCount(total)} looked up, ${found.toLocaleString()} found.`;
  return (
    <Popover
      trigger="click"
      content={
        <Flex vertical gap="small" align="start">
          <Typography.Text>{description}</Typography.Text>
          <Button size="small" onClick={() => finder.stop()}>
            Stop
          </Button>
        </Flex>
      }
    >
      <Button
        type="text"
        shape="circle"
        aria-label={description}
        icon={<ProgressRing done={done / total} />}
      />
    </Popover>
  );
}
