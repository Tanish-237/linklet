import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

// Import the logo correctly
import logo from "../assets/linklet-logo.png";

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll for navigation effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!event.target.closest(".mobile-menu-container")) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]);

  // Prevent default margins and handle overflow
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.documentElement.style.margin = "";
      document.documentElement.style.padding = "";
      document.body.style.overflow = "";
    };
  }, []);

  const features = [
    {
      title: "Learn",
      icon: "school",
      description:
        "Access curated learning resources tailored to your skill level.",
    },
    {
      title: "Connect",
      icon: "group",
      description:
        "Join study groups and collaborate with like-minded learners.",
    },
    {
      title: "Track",
      icon: "analytics",
      description:
        "Monitor your progress with detailed analytics and insights.",
    },
    {
      title: "Discuss",
      icon: "forum",
      description: "Engage in meaningful discussions with peers and experts.",
    },
    {
      title: "Practice",
      icon: "code",
      description: "Strengthen your skills with hands-on coding exercises.",
    },
    {
      title: "Grow",
      icon: "trending_up",
      description: "Build your portfolio and advance your career path.",
    },
  ];

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Helmet>
        <title>Linklet | Your Complete Learning Journey</title>
        <meta
          name="description"
          content="One platform to learn, connect, and grow. Focus on what matters most - your education and development."
        />
        <meta
          property="og:title"
          content="Linklet | Your Complete Learning Journey"
        />
        <meta
          property="og:description"
          content="One platform to learn, connect, and grow."
        />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#6D28D9" />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </Helmet>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-[73px] ${
          scrolled
            ? "bg-black/50 backdrop-blur-md border-b border-gray-800 shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="h-full px-6">
          <div className="flex items-center justify-between h-full">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="flex items-center p-1.5">
                <img src={logo} alt="Linklet Logo" className="h-10 w-10" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-wide text-white">
                Linklet
              </h1>
            </div>

            {/* Center Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-gray-300 hover:text-violet-400 transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#testimonials"
                className="text-gray-300 hover:text-violet-400 transition-colors font-medium"
              >
                Testimonials
              </a>
              <a
                href="#pricing"
                className="text-gray-300 hover:text-violet-400 transition-colors font-medium"
              >
                Pricing
              </a>
            </div>

            {/* Right Side Actions */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-violet-400 hover:bg-violet-900/30 transition-all"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-all font-medium"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-violet-900/30 transition-all"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="material-icons text-2xl text-gray-300 hover:text-violet-400">
                {isMobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-[73px] left-0 right-0 bg-black/50 backdrop-blur-md border-b border-gray-800">
            <div className="px-6 py-4 space-y-4">
              <a
                href="#features"
                className="block px-4 py-2 rounded-lg text-gray-300 hover:text-violet-400 hover:bg-violet-900/30 transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#testimonials"
                className="block px-4 py-2 rounded-lg text-gray-300 hover:text-violet-400 hover:bg-violet-900/30 transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Testimonials
              </a>
              <a
                href="#pricing"
                className="block px-4 py-2 rounded-lg text-gray-300 hover:text-violet-400 hover:bg-violet-900/30 transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <hr className="border-gray-800" />
              <Link
                to="/login"
                className="block px-4 py-2 rounded-lg text-gray-300 hover:text-violet-400 hover:bg-violet-900/30 transition-all"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="block px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-all text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="w-full min-h-screen">
        {/* Hero Section */}
        <section className="relative w-full min-h-screen flex items-center justify-center">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 -left-10 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 -right-10 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
          </div>

          <div className="w-full px-4 sm:px-6 lg:px-8 pt-16">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent leading-tight">
                Your Complete Learning Journey
              </h1>
              <p className="text-lg sm:text-xl text-gray-300 mb-8">
                One platform to learn, connect, and grow. Focus on what matters
                most - your education and development.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-8 py-4 rounded-lg bg-violet-600 hover:bg-violet-700 transition-colors text-lg font-semibold"
                >
                  Start Learning Now
                </Link>
                <a
                  href="#features"
                  className="w-full sm:w-auto px-8 py-4 rounded-lg border border-violet-500/30 hover:border-violet-500 transition-colors text-lg font-semibold"
                >
                  Explore Features
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="w-full min-h-screen py-20 px-4 sm:px-6 lg:px-8 flex items-center"
        >
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
                Everything You Need
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                A comprehensive platform designed to support every aspect of
                your learning journey.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20 hover:border-violet-500/40 transition-all group"
                >
                  <span className="material-icons text-4xl text-violet-400 mb-4">
                    {feature.icon}
                  </span>
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-violet-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section
          id="testimonials"
          className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-black/30"
        >
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
                Success Stories
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Join thousands of learners who are already advancing their
                careers with Linklet.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800 hover:border-violet-500/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-violet-800/50 flex-shrink-0"></div>
                  <div>
                    <p className="text-gray-300 italic mb-4">
                      "Linklet transformed how I approach continuous learning.
                      The structured paths and community support made all the
                      difference."
                    </p>
                    <p className="font-semibold text-violet-400">
                      Alex Johnson
                    </p>
                    <p className="text-sm text-gray-400">
                      Software Developer, TechCorp
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800 hover:border-violet-500/40 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-violet-800/50 flex-shrink-0"></div>
                  <div>
                    <p className="text-gray-300 italic mb-4">
                      "From beginner to professional, Linklet provided resources
                      that grew with me. The practice exercises were
                      particularly valuable."
                    </p>
                    <p className="font-semibold text-violet-400">Sarah Chen</p>
                    <p className="text-sm text-gray-400">
                      Data Scientist, DataDrive
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 px-4 sm:px-6 lg:px-8 bg-gray-900/80 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Linklet Logo" className="h-8 w-8" />
                <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
                  Linklet
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Empowering learners worldwide with comprehensive education tools
                and resources.
              </p>
              <div className="flex space-x-4">
                <a
                  href="https://twitter.com/linklet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-violet-400 transition-colors"
                >
                  <span className="material-icons">twitter</span>
                </a>
                <a
                  href="https://linkedin.com/company/linklet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-violet-400 transition-colors"
                >
                  <span className="material-icons">linkedin</span>
                </a>
                <a
                  href="https://github.com/linklet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-violet-400 transition-colors"
                >
                  <span className="material-icons">code</span>
                </a>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#features"
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById("features")
                        .scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <Link
                    to="/resources"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Resources
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/about"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    to="/careers"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/privacy"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cookies"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="text-gray-400 hover:text-violet-400 transition-colors"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} Linklet. All rights reserved.
              </p>
              <div className="flex items-center space-x-4">
                <select
                  className="bg-gray-800 text-gray-400 text-sm rounded-lg px-3 py-1 border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                  defaultValue="en"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
                <select
                  className="bg-gray-800 text-gray-400 text-sm rounded-lg px-3 py-1 border border-gray-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                  defaultValue="usd"
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="gbp">GBP</option>
                  <option value="inr">INR</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
