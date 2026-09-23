import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiClient } from "../../api/apiClient.js";
import SEO from "../../components/SEO";

const CONTACT_DESCRIPTION =
  "Reach the Linklet team for support, feedback, or to contribute to the campus platform built for MNNIT Allahabad students.";

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "General Inquiry",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("no-scrollbar");
    document.body.classList.add("no-scrollbar");
    return () => {
      document.documentElement.classList.remove("no-scrollbar");
      document.body.classList.remove("no-scrollbar");
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post("/contact", formData);
      setSubmitted(true);
      toast.success(response.data?.message || "Message sent successfully! We'll get back to you shortly.");
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: "General Inquiry",
        message: "",
      });
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || "Failed to send your message. Please try again.";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-page min-h-screen bg-canvas text-fg no-scrollbar pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <SEO title="Contact Linklet | Support & Feedback" ogTitle="Contact Linklet" description={CONTACT_DESCRIPTION} path="/contact" />
      <div className="max-w-5xl mx-auto">
        {/* Header Hero Section */}
        <div className="mb-12 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono tracking-wider uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            Campus Support & Feedback
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-fg mb-4">
            How can we help you today?
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Have a question about your timetable, feedback on study resources, interested in contributing, or spotted a bug? Send us a message and our student dev team will respond.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
            <div className="text-xs font-mono text-violet-400 mb-2">01 / TECHNICAL</div>
            <h3 className="text-base font-semibold text-fg mb-1.5">App Support</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Issues with attendance calculation, login sessions, or lecture schedules.
            </p>
            <span className="text-xs font-mono text-zinc-400">
              Quick assistance via form below
            </span>
          </div>

          <div className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
            <div className="text-xs font-mono text-violet-400 mb-2">02 / ACADEMIC</div>
            <h3 className="text-base font-semibold text-fg mb-1.5">Study Resources</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Share past year question papers (PYQs), lab records, or semester notes.
            </p>
            <span className="text-xs font-mono text-zinc-400">
              Community curated repository
            </span>
          </div>

          <a
            href="https://maps.google.com/?q=MNNIT+Allahabad+Prayagraj"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-colors block group"
          >
            <div className="text-xs font-mono text-violet-400 mb-2">03 / CAMPUS</div>
            <h3 className="text-base font-semibold text-fg mb-1.5 flex items-center justify-between">
              MNNIT Allahabad
              <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors text-xs">↗</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Teliarganj, Prayagraj, Uttar Pradesh 211004, India.
            </p>
            <span className="text-xs font-mono text-violet-400">
              View on Google Maps
            </span>
          </a>
        </div>

        {/* Contact Form & Side Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7 p-7 sm:p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80">
            <h2 className="text-xl font-semibold text-fg mb-6">
              Send us a Message
            </h2>

            {submitted ? (
              <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-xl my-4">
                <span className="material-icons text-4xl text-violet-400 mb-3">check_circle</span>
                <h3 className="text-lg font-semibold text-fg mb-2">Thank you!</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Your message has been received. Our support team will respond shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-fg font-medium text-xs transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="e.g. Tanish Sharma"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-fg placeholder-fg-subtle text-sm transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Your Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-fg placeholder-fg-subtle text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Category
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-fg text-sm transition-colors"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Contribute to Linklet">Contribute to Linklet (Dev / Design)</option>
                      <option value="Timetable Issue">Timetable & Schedule</option>
                      <option value="Resource Hub">Resource Hub Contribution</option>
                      <option value="Bug Report">Bug Report</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      placeholder="Brief topic..."
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-fg placeholder-fg-subtle text-sm transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us what you need help with..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-fg placeholder-fg-subtle text-sm resize-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-5 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-fg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* Guidelines & Info Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80">
              <h3 className="text-sm font-semibold text-fg mb-4">
                Campus Guidelines
              </h3>
              <div className="space-y-4 text-xs text-zinc-400 leading-relaxed">
                <div>
                  <h4 className="font-medium text-zinc-200 mb-1">
                    Open Inquiries
                  </h4>
                  <p>
                    Whether you are a student, faculty member, or visitor, feel free to reach out with questions or feedback using any active email address.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-200 mb-1">
                    Contributors Welcome
                  </h4>
                  <p>
                    Passionate about building campus software? We warmly invite developers, designers, and students of all batches to contribute. Select "Contribute to Linklet" to collaborate.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-200 mb-1">
                    Study Material Contributions
                  </h4>
                  <p>
                    Ensure submitted PYQs, notes, and lab manuals are legible and clearly tagged with semester and course code.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-200 mb-1">
                    Timetable Discrepancies
                  </h4>
                  <p>
                    If an updated departmental notification shifts your lecture slots, let us know and our maintainers will update the section master.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;