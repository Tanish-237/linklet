import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SITE_URL, DEFAULT_OG_IMAGE } from "../../config";

const TERMS_DESCRIPTION = "The rules for using Linklet, the campus platform for MNNIT Allahabad students.";

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

const TermsOfServicePage = () => {
  useEffect(() => {
    document.documentElement.classList.add("no-scrollbar");
    document.body.classList.add("no-scrollbar");
    return () => {
      document.documentElement.classList.remove("no-scrollbar");
      document.body.classList.remove("no-scrollbar");
    };
  }, []);

  return (
    <div className="terms-page min-h-screen bg-[#0a0a0a] text-zinc-100 no-scrollbar pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Terms of Service | Linklet</title>
        <meta name="description" content={TERMS_DESCRIPTION} />
        <meta property="og:title" content="Terms of Service | Linklet" />
        <meta property="og:description" content={TERMS_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/terms`} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Terms of Service | Linklet" />
        <meta name="twitter:description" content={TERMS_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono tracking-wider uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            MNNIT Allahabad Campus Platform
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            By creating a Linklet account or using the platform, you agree to these terms. Please read them.
          </p>
          <p className="text-sm text-zinc-500 mt-4">Last updated: September 2026</p>
        </div>

        <Section number="01" title="Eligibility">
          <p>
            Linklet is available only to current students, faculty, and staff of MNNIT Allahabad holding a
            valid <span className="text-zinc-100">@mnnit.ac.in</span> institutional email address. We reserve
            the right to suspend or terminate accounts that don't meet this requirement, including if
            institutional affiliation ends.
          </p>
        </Section>

        <Section number="02" title="Your account">
          <p>
            You are responsible for keeping your login credentials confidential and for all activity that
            happens under your account. Tell us immediately via the{" "}
            <Link to="/contact" className="text-violet-400 hover:text-violet-300 underline">
              Contact page
            </Link>{" "}
            if you suspect unauthorized access.
          </p>
        </Section>

        <Section number="03" title="Acceptable use">
          <p>You agree not to use Linklet to:</p>
          <ul className="list-disc list-inside space-y-2 marker:text-violet-400">
            <li>Harass, bully, impersonate, or threaten another student or staff member.</li>
            <li>Post or share content that is defamatory, obscene, or violates someone else's rights, including copyrighted material you don't have permission to share.</li>
            <li>Upload malware, attempt to bypass rate limits or authentication, scrape the platform at scale, or otherwise interfere with its normal operation.</li>
            <li>Use the platform for commercial advertising unrelated to campus academic/community life.</li>
            <li>Create multiple accounts to evade a ban or manipulate votes/reactions.</li>
          </ul>
          <p>
            Violations may result in content removal, a warning, a temporary suspension, or a permanent ban,
            at the discretion of Linklet's administrators, depending on severity.
          </p>
        </Section>

        <Section number="04" title="Your content">
          <p>
            You retain ownership of content you post — notes, resources, questions, posts, and messages. By
            posting, you grant Linklet a license to store, display, and distribute that content within the
            platform to other users as intended by the feature you used (e.g. a public post is shown to other
            students; a chat message is shown only to that conversation's participants).
          </p>
          <p>
            You're responsible for ensuring you have the right to share any resource (notes, question papers,
            etc.) you upload. Report content that shouldn't be here through the in-app report feature or the{" "}
            <Link to="/contact" className="text-violet-400 hover:text-violet-300 underline">
              Contact page
            </Link>
            .
          </p>
        </Section>

        <Section number="05" title="Academic tools are aids, not authorities">
          <p>
            The attendance tracker, timetable parser, and dashboard are convenience tools built by students to
            help you stay organized. They are not official institute records. Always verify attendance
            percentages and academic standing against your department's official records before relying on
            Linklet's numbers for anything consequential.
          </p>
        </Section>

        <Section number="06" title="Availability">
          <p>
            Linklet is an independent, community-built project and is provided "as is," without warranty of
            uninterrupted availability. We aim for reliability but don't guarantee the platform will always be
            up, bug-free, or lossless — please don't treat it as your only backup for critical academic files.
          </p>
        </Section>

        <Section number="07" title="Account suspension & termination">
          <p>
            We may suspend or terminate an account that violates these terms, is used for abuse, or is no
            longer eligible under our institutional-email requirement. You can also delete your own account at
            any time by contacting us — see our{" "}
            <Link to="/privacy" className="text-violet-400 hover:text-violet-300 underline">
              Privacy Policy
            </Link>{" "}
            for what happens to your data after deletion.
          </p>
        </Section>

        <Section number="08" title="Changes to these terms">
          <p>
            We may update these terms as the platform evolves. Material changes will be announced through the
            in-app notification system, and continued use of Linklet after a change means you accept the
            updated terms.
          </p>
        </Section>

        <Section number="09" title="Contact">
          <p>
            Questions about these terms? Reach out via the{" "}
            <Link to="/contact" className="text-violet-400 hover:text-violet-300 underline">
              Contact page
            </Link>
            .
          </p>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-zinc-800/80 text-sm">
          <span className="text-zinc-400">Also see how we handle your data.</span>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Read Privacy Policy
            <span className="text-xs">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
