import { create } from "zustand";
import { withThemeTransition } from "./themeTransition";

// Kept in sync with the inline boot script in index.html, which applies the
// theme before first paint so there is no light/dark flash on load.
const THEME_STORAGE_KEY = "linklet_theme";
const THEME_PREFERENCES = ["light", "dark", "system"];

// Must equal --canvas in index.css (and the boot colours in index.html), or the
// page background visibly shifts when the stylesheet loads.
const THEME_COLORS = { light: "#f1f2f5", dark: "#0a0a0c" };

const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

const readPreference = () => {
  try {
    const stored = canUseDOM ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
    return THEME_PREFERENCES.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const systemPrefersDark = () =>
  canUseDOM && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;

const resolve = (preference) =>
  preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;

// Switches instantly rather than cross-fading every element on the page —
// a blanket `* { transition }` while toggling was previously measurably
// janky on element-heavy pages (Dashboard's schedule grid, stat cards,
// etc.), so this now just flips the attribute straight away, same as most
// production apps (GitHub, Linear, Vercel) do.
const applyTheme = (theme) => {
  if (!canUseDOM) return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
};

const initialPreference = readPreference();

const useThemeStore = create((set, get) => ({
  preference: initialPreference,
  theme: resolve(initialPreference),

  // `origin` ({ x, y }) is optional; when given, the new theme is revealed as
  // a circle expanding from that point (see themeTransition.js).
  setPreference: (preference, origin) => {
    if (!THEME_PREFERENCES.includes(preference)) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage unavailable (private mode) – theme still applies for this session.
    }
    const theme = resolve(preference);
    const commit = () => {
      applyTheme(theme);
      set({ preference, theme });
    };
    if (theme === get().theme) commit();
    else withThemeTransition(origin, commit);
  },

  toggleTheme: (origin) => {
    get().setPreference(get().theme === "dark" ? "light" : "dark", origin);
  },

  // Re-resolve when the OS theme changes while following the system.
  syncWithSystem: () => {
    if (get().preference !== "system") return;
    const theme = resolve("system");
    applyTheme(theme);
    set({ theme });
  },
}));

if (canUseDOM) {
  applyTheme(useThemeStore.getState().theme);
  if (typeof window.matchMedia === "function") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => useThemeStore.getState().syncWithSystem());
  }
}

export default useThemeStore;
