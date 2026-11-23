// The <style> antd adds to stop the page scrolling while a dialog is open, one
// for each open dialog. It comes from rc-util's scroll locker.
const DIALOG_SCROLL_LOCK = 'style[rc-util-key^="rc-util-locker-"]';

/**
 * Holds the page still behind dialogs, until the function it returns is called.
 *
 * antd stops the page scrolling behind a dialog by hiding the body's vertical
 * overflow, which iOS Safari ignores for touch. It only stops a page being
 * dragged when it can't scroll either way, and lets it be dragged anyway while
 * its toolbar is collapsed or the keyboard is up. So while antd's lock is on,
 * the page is cut to the window's height, leaving it nothing to scroll, and the
 * body is scrolled instead to keep the same part of it in view. When the last
 * dialog closes, the page is scrolled back to where it was.
 *
 * Fixing the body in place, the usual way, would turn the strips behind
 * Safari 26's status bar and toolbar grey.
 */
export function pinPageBehindDialogs(): () => void {
  const html = document.documentElement;
  const { body } = document;
  let pinnedAt: { x: number; y: number } | undefined;

  const unpin = () => {
    if (!pinnedAt) {
      return;
    }
    const { x, y } = pinnedAt;
    pinnedAt = undefined;
    for (const element of [html, body]) {
      element.style.removeProperty("overflow");
      element.style.removeProperty("height");
    }
    if (window.scrollX !== x || window.scrollY !== y) {
      window.scrollTo(x, y);
    }
  };

  const update = () => {
    const isLocked = document.head.querySelector(DIALOG_SCROLL_LOCK) !== null;
    if (isLocked && !pinnedAt) {
      pinnedAt = { x: window.scrollX, y: window.scrollY };
      for (const element of [html, body]) {
        element.style.overflow = "hidden";
        element.style.height = "100%";
      }
      body.scrollLeft = pinnedAt.x;
      body.scrollTop = pinnedAt.y;
    } else if (!isLocked) {
      unpin();
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(document.head, { childList: true });
  update();

  return () => {
    observer.disconnect();
    unpin();
  };
}
