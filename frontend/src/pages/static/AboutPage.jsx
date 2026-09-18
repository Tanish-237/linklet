import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SITE_URL, DEFAULT_OG_IMAGE } from "../../config";

const ABOUT_DESCRIPTION =
  "Linklet is the campus platform built by MNNIT Allahabad students to organize schedules, share academic resources, and connect with classmates.";

const AboutPage = () => {
  useEffect(() => {
    document.documentElement.classList.add("no-scrollbar");
    document.body.classList.add("no-scrollbar");
    return () => {
      document.documentElement.classList.remove("no-scrollbar");
      document.body.classList.remove("no-scrollbar");
    };
  }, []);

  return (
    <div className="about-page min-h-screen bg-[#0a0a0a] text-zinc-100 no-scrollbar pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>About Linklet | MNNIT Allahabad Campus Platform</title>
        <meta name="description" content={ABOUT_DESCRIPTION} />
        <meta property="og:title" content="About Linklet" />
        <meta property="og:description" content={ABOUT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/about`} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About Linklet" />
        <meta name="twitter:description" content={ABOUT_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        {/* Header Badge & Title */}
        <div className="mb-12 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono tracking-wider uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            MNNIT Allahabad Campus Platform
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            About Linklet
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            A comprehensive learning platform engineered by students to eliminate fragmented spreadsheets, lost drive links, and chaotic chat groups across our campus.
          </p>
        </div>

        {/* Story / Problem Statement */}
        <section className="space-y-6 text-zinc-300 leading-relaxed mb-16 text-[15px]">
          <p>
            College life at MNNIT is fast-paced and demanding. In any given semester, students juggle tight lecture schedules across LT complexes and department halls, monitor their attendance against the mandatory 75% threshold, hunt for previous-year question papers (PYQs), and scramble to find verified notes before mid-sem and end-sem exams.
          </p>
          <p>
            Too often, critical academic information ends up scattered across chaotic messaging threads, forgotten cloud drives, and outdated spreadsheets. Linklet was conceived to solve this exact problem: providing a single, reliable hub built specifically for the academic rhythm of Motilal Nehru National Institute of Technology.
          </p>
        </section>

        {/* Core Pillars */}
        <div className="mb-16">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-6">
            Core Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
              <div className="text-xs font-mono text-violet-400 mb-2">01 / SCHEDULE</div>
              <h3 className="text-base font-semibold text-white mb-2">
                Timetable & Attendance Tracking
              </h3>
              <p className="text-sm text-zinc-400 leading-normal">
                Section-specific timetables aligned with institute lecture slots, coupled with one-tap attendance logging to always know your margin above 75%.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
              <div className="text-xs font-mono text-violet-400 mb-2">02 / ACADEMICS</div>
              <h3 className="text-base font-semibold text-white mb-2">
                Semester Resource Hub
              </h3>
              <p className="text-sm text-zinc-400 leading-normal">
                Searchable repository of lecture notes, lab records, assignments, and PYQs organized cleanly by engineering branch and semester.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
              <div className="text-xs font-mono text-violet-400 mb-2">03 / FORUM</div>
              <h3 className="text-base font-semibold text-white mb-2">
                Campus Help Forum
              </h3>
              <p className="text-sm text-zinc-400 leading-normal">
                Tagged, searchable question-and-answer space where students can clarify subject doubts, discuss coursework, and share solutions.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
              <div className="text-xs font-mono text-violet-400 mb-2">04 / COMMUNITY</div>
              <h3 className="text-base font-semibold text-white mb-2">
                Verified Peer Collaboration
              </h3>
              <p className="text-sm text-zinc-400 leading-normal">
                Direct and group messaging for project teams and clubs, strictly gated to verified institutional emails for a trusted environment.
              </p>
            </div>
          </div>
        </div>

        {/* Mission Section */}
        <section className="p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800 mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Our Mission</h2>
          <p className="text-zinc-300 leading-relaxed text-[15px] mb-4">
            To build reliable, focused, and high-performance digital tools that respect students' time, streamline academic coordination, and strengthen the collaborative culture of MNNIT Allahabad.
          </p>
          <p className="text-sm text-zinc-400">
            No advertisements. No third-party data tracking. Crafted by students, for students.
          </p>
        </section>

        {/* Contributors Welcome Section */}
        <section className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/90 mb-16">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono uppercase bg-zinc-800/80 text-violet-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Open Source & Community
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">
            Contributors Are Welcome
          </h2>
          <p className="text-zinc-300 leading-relaxed text-[15px] mb-4">
            Linklet is built by the student community, for the student community. Whether you're interested in full-stack engineering, UI/UX design, testing, or curating academic resources, we warmly welcome contributions from developers, designers, and students across all batches and branches.
          </p>
          <p className="text-sm text-zinc-400">
            Have an idea for a feature or want to build with us? Reach out through our contact page by selecting the contributor option.
          </p>
        </section>

        {/* Footer Navigation CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-zinc-800/80 text-sm">
          <span className="text-zinc-400">
            Have ideas, questions, or want to contribute to Linklet?
          </span>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Get in Touch / Contribute
            <span className="text-xs">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;