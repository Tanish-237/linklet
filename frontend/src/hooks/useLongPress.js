import { useCallback, useEffect, useRef } from "react";

const MOVE_TOLERANCE_PX = 10;

/**
 * Touch long-press — the phone equivalent of hover menus and right-click.
 * iOS Safari never fires `contextmenu` on a long-press, so anything that
 * relied on it (or on hover) was unreachable on iPhones.
 *
 *   const bindLongPress = useLongPress();
 *   <div {...bindLongPress((e) => openMenu(e), { onContextMenu: openMenu })} />
 *
 * The callback gets `{ currentTarget, clientX, clientY, preventDefault,
 * stopPropagation }` for the pressed element. A press that moves (a scroll)
 * is cancelled. After it fires, the tap that would follow is swallowed, and
 * the browser's own long-press menu / Android's `contextmenu` are suppressed;
 * a mouse right-click still goes to `onContextMenu`.
 */
export default function useLongPress({ delay = 450 } = {}) {
  const press = useRef({ timer: null, x: 0, y: 0, fired: false, touching: false });

  const cancel = useCallback(() => {
    clearTimeout(press.current.timer);
    press.current.timer = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return useCallback(
    (onLongPress, { onTouchStart, onContextMenu } = {}) => ({
      onTouchStart: (e) => {
        onTouchStart?.(e);
        cancel();
        const touch = e.touches[0];
        if (!touch || e.touches.length > 1) return;
        const target = e.currentTarget;
        Object.assign(press.current, { x: touch.clientX, y: touch.clientY, fired: false, touching: true });
        press.current.timer = setTimeout(() => {
          press.current.timer = null;
          press.current.fired = true;
          navigator.vibrate?.(10);
          onLongPress({
            currentTarget: target,
            clientX: press.current.x,
            clientY: press.current.y,
            preventDefault() {},
            stopPropagation() {},
          });
        }, delay);
      },
      onTouchMove: (e) => {
        const touch = e.touches[0];
        if (!press.current.timer || !touch) return;
        if (Math.hypot(touch.clientX - press.current.x, touch.clientY - press.current.y) > MOVE_TOLERANCE_PX) cancel();
      },
      onTouchEnd: (e) => {
        cancel();
        press.current.touching = false;
        // No click after a long-press: it would close the menu that just opened.
        if (press.current.fired) e.preventDefault();
        press.current.fired = false;
      },
      onTouchCancel: () => {
        cancel();
        press.current.touching = false;
      },
      onContextMenu: (e) => {
        if (press.current.touching) {
          e.preventDefault();
          return;
        }
        onContextMenu?.(e);
      },
    }),
    [cancel, delay]
  );
}
