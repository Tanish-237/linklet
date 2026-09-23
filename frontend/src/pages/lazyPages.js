import React, { lazy } from "react";

const RELOAD_KEY = "linklet_chunk_reload_at";

/**
 * After a deploy, a tab still running the previous build asks for page chunks
 * whose hashed filenames no longer exist, and the import fails. Reload once to
 * pick up the new build; the timestamp guard stops a reload loop if the chunk
 * is genuinely unreachable (e.g. offline), letting the ErrorBoundary show.
 * Returns true if a reload was started.
 */
const reloadForStaleChunk = (error) => {
  if (typeof window === "undefined") return false;
  const message = String(error?.message || "");
  const isChunkError =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type/i.test(
      message
    );
  if (!isChunkError) return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

/**
 * React.lazy with an explicit `preload()`. Once the chunk has loaded, the
 * wrapper renders the real component directly instead of going through the
 * lazy boundary — so if the chunk was fetched before the first render, React
 * never suspends and never shows the Suspense fallback for it.
 */
const lazyWithPreload = (factory) => {
  let Loaded = null;
  let pending = null;
  const load = () => {
    pending ??= factory().then(
      (mod) => {
        Loaded = mod.default;
        return mod;
      },
      (error) => {
        // Don't cache the failure, so the next attempt can try again.
        pending = null;
        throw error;
      }
    );
    return pending;
  };
  // Only a render (the user actually opening the page) may reload — a failed
  // background preload must not yank the page they're currently reading.
  const LazyComponent = lazy(() =>
    load().catch((error) => {
      if (reloadForStaleChunk(error)) return new Promise(() => {});
      throw error;
    })
  );
  const PreloadableComponent = (props) =>
    Loaded ? React.createElement(Loaded, props) : React.createElement(LazyComponent, props);
  PreloadableComponent.preload = load;
  return PreloadableComponent;
};

export const Home = lazyWithPreload(() => import("./Home"));
export const LandingPage = lazyWithPreload(() => import("./LandingPage"));
export const Login = lazyWithPreload(() => import("./Login"));
export const Register = lazyWithPreload(() => import("./Register"));
export const ForgotPassword = lazyWithPreload(() => import("./ForgotPassword"));
export const Posts = lazyWithPreload(() => import("./Posts"));
export const PostDetail = lazyWithPreload(() => import("./PostDetail"));
export const CreatePost = lazyWithPreload(() => import("./CreatePost"));
export const Resource = lazyWithPreload(() => import("./Resource"));
export const ChatPage = lazyWithPreload(() => import("./ChatPage"));
export const Dashboard = lazyWithPreload(() => import("./Dashboard"));
export const HelpForum = lazyWithPreload(() => import("./HelpForum"));
export const AskQuestion = lazyWithPreload(() => import("./AskQuestion"));
export const QuestionDetail = lazyWithPreload(() => import("./QuestionDetail"));
export const GamesAndVideos = lazyWithPreload(() => import("./GamesAndVideos"));
export const AdminDashboard = lazyWithPreload(() => import("./AdminDashboard"));
export const Profile = lazyWithPreload(() => import("./Profile"));
export const Saved = lazyWithPreload(() => import("./Saved"));
export const Settings = lazyWithPreload(() => import("./Settings"));
export const NotFound = lazyWithPreload(() => import("./NotFound"));

export const AboutPage = lazyWithPreload(() => import("./static/AboutPage"));
export const ContactPage = lazyWithPreload(() => import("./static/ContactPage"));
export const PrivacyPolicyPage = lazyWithPreload(() => import("./static/PrivacyPolicyPage"));
export const TermsOfServicePage = lazyWithPreload(() => import("./static/TermsOfServicePage"));

// The routes scripts/prerender.mjs ships as static HTML. main.jsx preloads the
// matching page before mounting so React's first commit replaces that HTML
// with the same finished page, not with a loading spinner.
const PRERENDERED_PAGES = {
  "/": LandingPage,
  "/about": AboutPage,
  "/contact": ContactPage,
  "/privacy": PrivacyPolicyPage,
  "/terms": TermsOfServicePage,
  "/posts": Posts,
};

export const preloadPrerenderedPage = (pathname) => {
  const page = PRERENDERED_PAGES[pathname.replace(/\/+$/, "") || "/"];
  return page ? page.preload().catch(() => {}) : Promise.resolve();
};

// Pages reachable from the signed-in app shell (Layout's nav). Layout warms
// these once the browser is idle so switching pages never waits on a chunk.
const APP_SHELL_PAGES = [Home, Dashboard, ChatPage, Resource, Saved, HelpForum, Profile, Settings];

export const preloadAppShellPages = () => {
  APP_SHELL_PAGES.forEach((page) => page.preload().catch(() => {}));
};
