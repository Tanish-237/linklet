import React, { useState } from "react";
import { toast } from "react-toastify";

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success("Message sent successfully! We'll get back to you shortly.");
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: "General Inquiry",
        message: "",
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Hero Section */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 text-violet-400 mb-4 inline-block">
            Get in Touch
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            How can we help you today?
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Have a question, feedback, or need support with Linklet? Send us a message and our team will get back to you within 24 hours.
          </p>
        </div>

        {/* Contact Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-violet-500/20 backdrop-blur-xl hover:border-violet-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-icons text-2xl">support_agent</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Student Support</h3>
            <p className="text-sm text-gray-400 mb-4">
              Need help navigating the help forum, resource hub, or account settings?
            </p>
            <span className="text-violet-400 text-sm font-semibold flex items-center gap-1">
              support@linklet.edu <span className="material-icons text-xs">arrow_forward</span>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-violet-500/20 backdrop-blur-xl hover:border-violet-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-icons text-2xl">school</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Campus Ambassadors</h3>
            <p className="text-sm text-gray-400 mb-4">
              Interested in promoting Linklet at your campus or hosting tech workshops?
            </p>
            <span className="text-purple-400 text-sm font-semibold flex items-center gap-1">
              ambassadors@linklet.edu <span className="material-icons text-xs">arrow_forward</span>
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-violet-500/20 backdrop-blur-xl hover:border-violet-500/40 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="material-icons text-2xl">location_on</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">MNNIT Allahabad</h3>
            <p className="text-sm text-gray-400 mb-4">
              Teliarganj, Prayagraj, Uttar Pradesh 211004, India
            </p>
            <span className="text-pink-400 text-sm font-semibold flex items-center gap-1">
              Main Campus Hub <span className="material-icons text-xs">arrow_forward</span>
            </span>
          </div>
        </div>

        {/* Contact Form & Side Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7 p-8 rounded-3xl bg-slate-900/70 border border-violet-500/25 backdrop-blur-2xl shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-icons text-violet-400">mail_outline</span>
              Send us a Message
            </h2>

            {submitted ? (
              <div className="p-8 text-center bg-violet-500/10 border border-violet-500/30 rounded-2xl my-4">
                <span className="material-icons text-5xl text-violet-400 mb-3">check_circle</span>
                <h3 className="text-xl font-bold text-white mb-2">Thank you!</h3>
                <p className="text-gray-300 text-sm mb-6">
                  Your message has been received. Our support team will respond shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold text-sm transition-all"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-slate-950/80 border border-violet-500/20 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-white placeholder-gray-500 text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                      College Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="you@mnnit.ac.in"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-slate-950/80 border border-violet-500/20 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-white placeholder-gray-500 text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-950/80 border border-violet-500/20 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-white text-sm transition-all"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Resource Hub Contribution">Resource Hub Contribution</option>
                      <option value="Feedback & Feature Request">Feedback & Feature Request</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      placeholder="Brief topic..."
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-950/80 border border-violet-500/20 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-white placeholder-gray-500 text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us what you need help with..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 bg-slate-950/80 border border-violet-500/20 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-white placeholder-gray-500 text-sm resize-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-medium text-sm shadow-sm transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="material-icons animate-spin text-base">hourglass_top</span>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-base">send</span>
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Quick FAQ / Info Side */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-violet-500/20 backdrop-blur-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-violet-400">help_outline</span>
                Frequently Asked Questions
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-violet-300 mb-1">
                    Who can join Linklet?
                  </h4>
                  <p className="text-gray-400">
                    Linklet is exclusively for students, faculty, and alumni with verified `@mnnit.ac.in` emails.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-violet-300 mb-1">
                    How do I contribute study resources?
                  </h4>
                  <p className="text-gray-400">
                    You can upload PDFs, notes, and previous year questions directly from the Global Search & Resource Hub page.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-violet-300 mb-1">
                    How do group chats work?
                  </h4>
                  <p className="text-gray-400">
                    Go to the Chat tab on your dashboard, click "Create Group", search for teammates, and start collaborating in real time!
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