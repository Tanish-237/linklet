import { flushSync } from "react-dom";

const DURATION_MS = 550;

/**
 * Runs `update` (which flips the theme) inside a View Transition, revealing
 * the new theme as a circle growing out from `origin` ({ x, y } in viewport
 * px). Falls back to an instant switch when the browser lacks View
 * Transitions, the user prefers reduced motion, or no origin is given.
 */
export function withThemeTransition(origin, update) {
  const canAnimate =
    origin &&
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!canAnimate) {
    update();
    return;
  }

  const { x, y } = origin;
  // Distance to the farthest viewport corner, so the circle covers everything.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const root = document.documentElement;
  // Per-element colour transitions would otherwise still be mid-fade inside
  // the new snapshot, so the reveal edge would show half-switched colours.
  root.classList.add("theme-switching");

  // flushSync so React re-renders (toggle icon etc.) land in the new snapshot.
  const transition = document.startViewTransition(() => flushSync(update));

  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: DURATION_MS,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    })
    .catch(() => {});

  transition.finished.finally(() => root.classList.remove("theme-switching"));
}

/** Centre of the element that triggered the event — works for keyboard clicks too. */
export function originFromEvent(event) {
  const el = event?.currentTarget;
  if (!el?.getBoundingClientRect) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
