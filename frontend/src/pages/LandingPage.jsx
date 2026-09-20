import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/linklet-logo.webp";
import SEO from "../components/SEO";
import { SITE_URL } from "../config";
import "./LandingPage.css";

// Inline SVG icons — no CDN dependency
const FeedIcon = () => (
  <svg
    className="landing-feature-card__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <line x1="6" y1="8" x2="18" y2="8" />
    <line x1="6" y1="11" x2="14" y2="11" />
  </svg>
);

const HelpForumIcon = () => (
  <svg
    className="landing-feature-card__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="landing-feature-card__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
    <line x1="11" y1="8" x2="11" y2="14" />
  </svg>
);

const DashboardIcon = () => (
  <svg
    className="landing-feature-card__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const FEATURES = [
  {
    title: "Campus Feed",
    description:
      "A daily feed of what's happening around campus — posts, updates, and conversations from your peers.",
    Icon: FeedIcon,
  },
  {
    title: "Help Forum",
    description:
      "Ask questions, upvote answers, and get help from classmates. Tagged, searchable, and always available.",
    Icon: HelpForumIcon,
  },
  {
    title: "Resource Hub",
    description:
      "Notes, assignments, and papers — all in one place. Find anything instantly with fuzzy search.",
    Icon: SearchIcon,
  },
  {
    title: "Dashboard & Schedule",
    description:
      "Track attendance, manage your timetable, and stay on top of your day with a personal dashboard.",
    Icon: DashboardIcon,
  },
];

const LANDING_DESCRIPTION =
  "Linklet is a platform for college students to manage schedules, track attendance, share posts, and chat with classmates.";

// Structured data so search engines can show Linklet as a named site with a logo.
const LANDING_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Linklet",
    url: SITE_URL,
    logo: `${SITE_URL}/linklet-logo.png`,
    description: LANDING_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Linklet",
    url: SITE_URL,
    description: LANDING_DESCRIPTION,
    inLanguage: "en-IN",
  },
];

export default function LandingPage() {
  const featuresRef = useRef(null);

  // Fade-in on scroll via IntersectionObserver
  useEffect(() => {
    const section = featuresRef.current;
    if (!section) return;

    const targets = section.querySelectorAll(".landing-fade-in");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-fade-in--visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page" id="landing-page">
      <SEO title="Linklet — Your campus, organized" description={LANDING_DESCRIPTION} path="/" jsonLd={LANDING_JSON_LD} />

      {/* Hero */}
      <section className="landing-hero" id="landing-hero">
        <h1 className="landing-hero__headline">
          Everything your campus needs.
          <br />
          One platform.
        </h1>
        <p className="landing-hero__subtitle">
          Manage your schedule, track attendance, share posts, and chat with
          classmates — without switching between a dozen apps.
        </p>
        <div className="landing-hero__actions">
          <Link to="/register" className="landing-hero__cta" id="cta-register">
            Get Started
          </Link>
          <p className="landing-hero__login">
            Already have an account?{" "}
            <Link to="/login" id="cta-login">
              Log in
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section
        className="landing-features"
        id="landing-features"
        ref={featuresRef}
      >
        <p className="landing-features__label landing-fade-in">What you get</p>
        <h2 className="landing-features__heading landing-fade-in">
          Solution to your every single problem
        </h2>
        <div className="landing-features__grid">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="landing-feature-card landing-fade-in"
              data-testid="feature-card"
            >
              <feature.Icon />
              <h3 className="landing-feature-card__title">{feature.title}</h3>
              <p className="landing-feature-card__desc">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer" id="landing-footer">
        <div className="landing-footer__container">
          <div className="landing-footer__main">
            {/* Brand Column */}
            <div className="landing-footer__brand">
              <div className="landing-footer__logo-group">
                <img
                  src={logo}
                  alt="Linklet"
                  className="landing-footer__logo"
                />
                <span className="landing-footer__name">Linklet</span>
              </div>
              <p className="landing-footer__tagline">
                Your campus, organized. Manage schedules, track attendance, and connect with classmates.
              </p>
            </div>

            {/* Links Section */}
            <div className="landing-footer__links-section">
              <ul className="landing-footer__list">
                <li>
                  <Link to="/about" className="landing-footer__link">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="landing-footer__link">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="landing-footer__link">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="landing-footer__link">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <a
                    href="https://maps.google.com/?q=MNNIT+Allahabad+Prayagraj"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-footer__link"
                    title="MNNIT Allahabad, Prayagraj"
                  >
                    Location
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="landing-footer__bottom">
            <p className="landing-footer__copy">
              © {new Date().getFullYear()} Linklet
            </p>
            <p className="landing-footer__note">
              Made with ❤️ for MNNITians
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
