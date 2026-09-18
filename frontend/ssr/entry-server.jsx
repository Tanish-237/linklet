import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import LandingPage from "../src/pages/LandingPage";
import AboutPage from "../src/pages/static/AboutPage";
import ContactPage from "../src/pages/static/ContactPage";
import PrivacyPolicyPage from "../src/pages/static/PrivacyPolicyPage";
import TermsOfServicePage from "../src/pages/static/TermsOfServicePage";

// Only genuinely static, public marketing/legal pages go here — no
// AuthContext/SocketContext/React Query needed, since none of these read
// user state at render time (see the comment in scripts/prerender.mjs for
// why the app's real Navbar and every other route are deliberately excluded).
const PAGES = {
  "/": LandingPage,
  "/about": AboutPage,
  "/contact": ContactPage,
  "/privacy": PrivacyPolicyPage,
  "/terms": TermsOfServicePage,
};

export const STATIC_ROUTES = Object.keys(PAGES);

export const renderPage = (path) => {
  const Page = PAGES[path];
  if (!Page) {
    throw new Error(`No prerenderable page registered for path "${path}"`);
  }

  const helmetContext = {};
  const html = renderToStaticMarkup(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={path}>
        <Page />
      </StaticRouter>
    </HelmetProvider>
  );

  return { html, helmet: helmetContext.helmet };
};
