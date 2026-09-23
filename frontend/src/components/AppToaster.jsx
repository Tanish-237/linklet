import React from "react";
import { Toaster } from "sonner";
import useThemeStore from "../theme/useThemeStore";

/**
 * App-wide toast host (Sonner). Colours come from the design tokens via the
 * `[data-sonner-toaster]` rules in index.css, so toasts match both themes.
 *
 * Top-right rather than Sonner's default bottom-right: the bottom of the
 * screen holds the mobile tab bar and the chat composer, which bottom toasts
 * would cover. On phones Sonner renders them full-width along the top.
 */
export default function AppToaster() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <Toaster
      theme={theme}
      position="top-right"
      duration={4000}
      visibleToasts={4}
      gap={10}
      offset={20}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      closeButton
      toastOptions={{ className: "linklet-toast" }}
    />
  );
}
