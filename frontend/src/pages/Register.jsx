import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { handleApiError } from "../utlis/ErrorHandler";
import { Helmet } from "react-helmet-async";

import linkletLogo from "../assets/linklet-logo.png";
import { apiClient } from "../api/apiClient";
import GoogleAuthButton from "../components/GoogleAuthButton";

const formatSectionInput = (val) => {
  if (!val) return "";
  return val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
};

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [subSection, setSubSection] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { fetchUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (!fullName.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      if (!email.toLowerCase().endsWith("@mnnit.ac.in")) {
        toast.error("Only @mnnit.ac.in email addresses are allowed");
        return;
      }
      if (!department) {
        toast.error("Please select your branch");
        return;
      }
    }

    setLoading(true);
    try {
      if (step === 1) {
        const res = await apiClient.post("/auth/send-otp", { email });
        if (res.status === 200) {
          toast.success(res.data.message || "OTP sent to your email!");
          setStep(2);
        }
      } else {
        const payload = {
          email,
          password,
          fullName: fullName.trim(),
          department,
          section: section.trim().toUpperCase(),
          subSection: subSection.trim().toUpperCase(),
          otp,
        };
        const res = await apiClient.post(`/auth/register`, payload);

        if (res.status === 201) {
          toast.success("Registration successful! Please login.");
          await fetchUser();
          navigate("/login");
        }
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Helmet>
        <title>Register | Linklet - Your Complete Learning Journey</title>
        <meta
          name="description"
          content="Join Linklet to start your learning journey. Connect with peers, access resources, and excel in your studies."
        />
        <meta property="og:title" content="Register | Linklet" />
        <meta
          property="og:description"
          content="Join Linklet to start your learning journey."
        />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#6D28D9" />
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src={linkletLogo} alt="Linklet Logo" className="h-10 w-10" />
              <span className="text-2xl font-bold tracking-tight text-white">
                Linklet
              </span>
            </Link>

            <Link
              to="/login"
              className="px-4 py-2 rounded-lg hover:bg-violet-900/30 transition-all border border-violet-500/30 hover:border-violet-500"
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full min-h-screen pt-16">
        <section className="relative w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 -left-10 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 -right-10 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
          </div>

          <div className="w-full max-w-xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-white">
                Join Linklet Today
              </h1>
              <p className="text-xl text-gray-300">
                Start your learning journey with our academic community
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-md rounded-xl border border-violet-500/20 p-8">
              <GoogleAuthButton mode="signup" />

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 py-0.5 bg-gray-900 border border-gray-800/80 rounded-full text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="fullName">
                    Full Name <span className="text-violet-400">*</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={step === 2}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="email">
                    College Email <span className="text-violet-400">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={step === 2}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="password">
                    Password <span className="text-violet-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={step === 2}
                      className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={step === 2}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] transition-all duration-200">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] transition-all duration-200">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="department">
                    Branch <span className="text-violet-400">*</span>
                  </label>
                  <select
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    disabled={step === 2}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50"
                  >
                    <option value="">Select Branch</option>
                    <option value="Computer Science and Engineering">Computer Science and Engineering</option>
                    <option value="Mathematics and Computing">Mathematics and Computing</option>
                    <option value="Electronics and Communication Engineering">Electronics and Communication Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Engineering and Computational Mechanics">Engineering and Computational Mechanics</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Chemical Engineering">Chemical Engineering</option>
                    <option value="Biotechnology">Biotechnology</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300" htmlFor="section">
                      Class Section
                    </label>
                    <input
                      id="section"
                      type="text"
                      placeholder="Eg. D, J, A, CE"
                      value={section}
                      onChange={(e) => setSection(formatSectionInput(e.target.value))}
                      maxLength={10}
                      disabled={step === 2}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50 uppercase placeholder:normal-case"
                    />
                    <p className="text-[11px] text-gray-400">Main lecture section</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300" htmlFor="subSection">
                      Sub-Section <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                    </label>
                    <input
                      id="subSection"
                      type="text"
                      placeholder="Eg. CE3, DF5, A1"
                      value={subSection}
                      onChange={(e) => setSubSection(formatSectionInput(e.target.value))}
                      maxLength={10}
                      disabled={step === 2}
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50 uppercase placeholder:normal-case"
                    />
                    <p className="text-[11px] text-gray-400">Tutorial or lab batch</p>
                  </div>
                </div>

                {step === 2 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300" htmlFor="otp">
                      Enter 6-digit OTP
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white tracking-widest text-center text-lg font-bold"
                    />
                    <p className="text-xs text-gray-400 mt-1">Please check your email inbox ({email}).</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-lg font-medium tracking-wide shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? "Processing..." : step === 1 ? "Send Verification OTP" : "Complete Registration"}
                </button>
                
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Change Details or Email
                  </button>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
