import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import SEO from "../SEO";

const renderSeo = (props) =>
  render(
    <HelmetProvider>
      <SEO {...props} />
    </HelmetProvider>
  );
const meta = (sel) => document.head.querySelector(sel)?.getAttribute("content");

describe("SEO component", () => {
  it("emits title, description, a single absolute canonical URL and indexable robots by default", async () => {
    console.log("TRACE [SEO.test]: canonical + indexable defaults");
    const { unmount } = renderSeo({ title: "About | Linklet", description: "About us", path: "/about" });
    await waitFor(() => {
      expect(document.title).toBe("About | Linklet");
      expect(meta('meta[name="description"]')).toBe("About us");
      expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
      expect(document.head.querySelector('link[rel="canonical"]').getAttribute("href")).toBe("https://linklet.org/about");
      expect(meta('meta[name="robots"]')).toBe("index, follow");
    });
    unmount();
  });

  it("uses the same canonical URL for og:url and the home page canonical is the site root", async () => {
    const { unmount } = renderSeo({ title: "Home", description: "d", path: "/" });
    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]').getAttribute("href")).toBe("https://linklet.org/");
      expect(meta('meta[property="og:url"]')).toBe("https://linklet.org/");
    });
    unmount();
  });

  it("emits a 1200x630 social image with dimensions and Twitter large-card tags", async () => {
    const { unmount } = renderSeo({ title: "T", description: "D", path: "/x" });
    await waitFor(() => {
      expect(meta('meta[property="og:image"]')).toBe("https://linklet.org/og-image.jpg");
      expect(meta('meta[property="og:image:width"]')).toBe("1200");
      expect(meta('meta[property="og:image:height"]')).toBe("630");
      expect(meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      expect(meta('meta[name="twitter:image"]')).toBe("https://linklet.org/og-image.jpg");
    });
    unmount();
  });

  it("noindex pages get 'noindex, nofollow'", async () => {
    const { unmount } = renderSeo({ title: "Login", description: "d", path: "/login", noindex: true });
    await waitFor(() => expect(meta('meta[name="robots"]')).toBe("noindex, nofollow"));
    unmount();
  });

  it("ogTitle overrides the social title without changing the document title", async () => {
    const { unmount } = renderSeo({ title: "Contact Linklet | Support", ogTitle: "Contact Linklet", description: "d", path: "/contact" });
    await waitFor(() => {
      expect(document.title).toBe("Contact Linklet | Support");
      expect(meta('meta[property="og:title"]')).toBe("Contact Linklet");
      expect(meta('meta[name="twitter:title"]')).toBe("Contact Linklet");
    });
    unmount();
  });

  it("renders JSON-LD structured data as valid JSON when provided, and nothing when not", async () => {
    console.log("TRACE [SEO.test]: JSON-LD block");
    const ld = { "@context": "https://schema.org", "@type": "Organization", name: "Linklet" };
    const { unmount } = renderSeo({ title: "T", description: "D", path: "/", jsonLd: ld });
    await waitFor(() => {
      const script = document.head.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeNull();
      expect(JSON.parse(script.textContent)).toEqual(ld);
    });
    unmount();

    const second = renderSeo({ title: "T2", description: "D" });
    await waitFor(() => expect(document.title).toBe("T2"));
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
    second.unmount();
  });
});
