import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SITE_URL, DEFAULT_OG_IMAGE } from "../../config";

const PRIVACY_DESCRIPTION =
  "How Linklet collects, uses, and protects the personal data of MNNIT Allahabad students who use the platform.";

const Section = ({ number, title, children }) => (
  <section className="mb-10">
    <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">
      {number} / {title}
    </h2>
    <div className="space-y-4 text-zinc-300 leading-relaxed text-[15px]">
      {children}
    </div>
  </section>
);

const PrivacyPolicyPage = () => {
  useEffect(() => {
    document.documentElement.classList.add("no-scrollbar");
    document.body.classList.add("no-scrollbar");
    return () => {
      document.documentElement.classList.remove("no-scrollbar");
      document.body.classList.remove("no-scrollbar");
    };
  }, []);

  return (
    <div className="privacy-page min-h-screen bg-[#0a0a0a] text-zinc-100 no-scrollbar pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Privacy Policy | Linklet</title>
        <meta name="description" content={PRIVACY_DESCRIPTION} />
        <meta property="og:title" content="Privacy Policy | Linklet" />
        <meta property="og:description" content={PRIVACY_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/privacy`} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Privacy Policy | Linklet" />
        <meta name="twitter:description" content={PRIVACY_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono tracking-wider uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            MNNIT Allahabad Campus Platform
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Linklet is built for MNNIT students, by MNNIT students. This page explains, in plain language, what
            we collect, why we collect it, and what we do — and don't do — with it.
          </p>
          <p className="text-sm text-zinc-500 mt-4">Last updated: September 2026</p>
        </div>

        <Section number="01" title="Who this applies to">
          <p>
            This policy covers anyone who creates a Linklet account or visits linklet.org. Registration is
            restricted to holders of an institutional <span className="text-zinc-100">@mnnit.ac.in</span> email
            address — Linklet is not open to the general public.
          </p>
        </Section>

        <Section number="02" title="What we collect">
          <p>When you register, we collect:</p>
          <ul className="list-disc list-inside space-y-2 marker:text-violet-400">
            <li>Your full name, institutional email address, and a password (stored as a bcrypt hash — we never store or see your plaintext password), or your Google account identifier if you sign in with Google.</li>
            <li>Academic details you provide: department/branch, semester, section, and academic year.</li>
            <li>Content you create: posts, questions, answers, comments, chat messages, uploaded resources (notes, PYQs, assignments), and profile information (bio, avatar, phone number if you choose to add one).</li>
            <li>Timetable and attendance data you upload or enter, used only to power your personal dashboard.</li>
            <li>Basic technical data: IP address (used for abuse/rate-limit protection) and a session cookie that keeps you logged in.</li>
          </ul>
        </Section>

        <Section number="03" title="Why we collect it">
          <p>
            Every field above exists to power a specific feature you use directly: your academic details drive
            the resource filters and dashboard, your chats and posts are shown to the people you're
            communicating with, and your IP is used only to throttle abusive request patterns (e.g. OTP
            brute-forcing), never to track you across the web.
          </p>
        </Section>

        <Section number="04" title="Third parties we rely on">
          <ul className="list-disc list-inside space-y-2 marker:text-violet-400">
            <li><span className="text-zinc-100">Google</span> — for institutional Google Sign-In, if you choose that login method.</li>
            <li><span className="text-zinc-100">Cloudinary</span> — stores images, documents, and voice notes you upload.</li>
            <li><span className="text-zinc-100">Brevo</span> — delivers OTP verification and password-reset emails.</li>
            <li><span className="text-zinc-100">Google Gemini</span> — used only when you upload a timetable image/PDF, to extract your class schedule. The file is processed for that request and not used to train any model on our end.</li>
          </ul>
          <p>
            We do not sell, rent, or share your personal data with advertisers, and we do not run third-party
            ad-tracking or analytics scripts on Linklet.
          </p>
        </Section>

        <Section number="05" title="Who can see what">
          <ul className="list-disc list-inside space-y-2 marker:text-violet-400">
            <li>Your posts, questions/answers, and public profile fields are visible to other logged-in Linklet users.</li>
            <li>Your chat messages are visible only to the participants of that conversation.</li>
            <li>Your email address and password are never shown to other students.</li>
            <li>Platform administrators can access account and content data solely to moderate abuse, respond to reports, and maintain platform integrity — every admin action is recorded in an audit log.</li>
          </ul>
        </Section>

        <Section number="06" title="How long we keep it">
          <p>
            We retain your data for as long as your account is active. If you delete your account, your profile,
            posts, and messages are removed from active use; some records may be retained briefly in backups or
            audit logs where required for security or legal reasons before being purged.
          </p>
        </Section>

        <Section number="07" title="Your rights">
          <p>
            You can review and update most of your information from your Settings page at any time. To request
            a full export or deletion of your account data, reach out through our{" "}
            <Link to="/contact" className="text-violet-400 hover:text-violet-300 underline">
              Contact page
            </Link>
            . We will respond and act on verified requests within a reasonable time.
          </p>
        </Section>

        <Section number="08" title="Changes to this policy">
          <p>
            If this policy changes in a way that affects how your data is used, we'll update the date at the
            top of this page and, for material changes, notify users through the in-app notification system.
          </p>
        </Section>

        <Section number="09" title="Contact">
          <p>
            Questions about this policy or how your data is handled? Reach out via the{" "}
            <Link to="/contact" className="text-violet-400 hover:text-violet-300 underline">
              Contact page
            </Link>
            .
          </p>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-zinc-800/80 text-sm">
          <span className="text-zinc-400">Also see how using Linklet works.</span>
          <Link
            to="/terms"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Read Terms of Service
            <span className="text-xs">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
