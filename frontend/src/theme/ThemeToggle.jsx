import React from "react";
import useThemeStore from "./useThemeStore";
import { originFromEvent } from "./themeTransition";

/**
 * Compact icon toggle for the rail's bottom cluster. Cycles light <-> dark.
 * For explicit "Light / Dark / System" control, see the segmented control
 * rendered in Settings.jsx (both read/write the same useThemeStore).
 *
 * `expanded` renders it as a full-width labelled row instead of a bare
 * icon circle, matching the other rail items when the sidebar is extended.
 */
export default function ThemeToggle({ className = "", expanded = false, id = "theme-toggle-btn" }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  // Sun and moon cross-fade + scale in place rather than one icon spinning
  // 180deg, which read as gimmicky sitting next to plain icon buttons.
  const iconStack = (
    <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
      <span
        className={`material-icons text-[18px] absolute transition-all duration-150 ${
          isDark ? "opacity-100 scale-100" : "opacity-0 scale-50"
        }`}
      >
        dark_mode
      </span>
      <span
        className={`material-icons text-[18px] absolute transition-all duration-150 ${
          isDark ? "opacity-0 scale-50" : "opacity-100 scale-100"
        }`}
      >
        light_mode
      </span>
    </span>
  );

  if (expanded) {
    return (
      <button
        type="button"
        id={id}
        onClick={(e) => toggleTheme(originFromEvent(e))}
        aria-label={label}
        title={label}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-fg-secondary hover:text-fg hover:bg-surface-2 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${className}`}
      >
        {iconStack}
        <span className="text-[14.5px] font-medium">{isDark ? "Dark mode" : "Light mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      id={id}
      onClick={(e) => toggleTheme(originFromEvent(e))}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full border border-line bg-surface-2 hover:bg-surface-3 text-fg-secondary hover:text-fg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${className}`}
    >
      {iconStack}
    </button>
  );
}

/**
 * Segmented Light / Dark / System control used in Settings.
 */
export function ThemeSegmentedControl({ className = "" }) {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const options = [
    { value: "light", label: "Light", icon: "light_mode" },
    { value: "dark", label: "Dark", icon: "dark_mode" },
    { value: "system", label: "System", icon: "computer" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-line ${className}`}
    >
      {options.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e) => setPreference(opt.value, originFromEvent(e))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
              active
                ? "bg-accent text-on-accent shadow-soft"
                : "text-fg-muted hover:text-fg hover:bg-surface-3"
            }`}
          >
            <span className="material-icons text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
