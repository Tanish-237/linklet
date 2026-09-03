import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { handleApiError } from "../utlis/ErrorHandler";
import { Helmet } from "react-helmet-async";

import linkletLogo from "../assets/linklet-logo.png";
import { apiClient } from "../api/apiClient";

const formatSectionInput = (val) => {
  if (!val) return "";
  const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!upper) return "";
  const first = upper[0].replace(/[^A-Z]/g, "");
  if (!first) return "";
  const second = upper.length > 1 ? upper[1].replace(/[^12]/g, "") : "";
  return (first + second).slice(0, 2);
};

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { fetchUser } = useAuth();

  const handleGoogleSignup = () => {
    // TODO: Implement Google OAuth
    toast.info("Google sign up will be available soon!");
  };

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
      if (section && !/^[A-Z][12]$/.test(section)) {
        toast.error("Section must be an alphabet followed by 1 or 2 (e.g. A1, A2, B1, B2)");
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
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
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
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
                Join Linklet Today
              </h1>
              <p className="text-xl text-gray-300">
                Start your learning journey with our academic community
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-md rounded-xl border border-violet-500/20 p-8">
              <button
                onClick={handleGoogleSignup}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-800 rounded-lg mb-6 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black/30 text-gray-400 backdrop-blur-sm">
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
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={step === 2}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50"
                  />
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

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="section">
                    Class Section
                  </label>
                  <input
                    id="section"
                    type="text"
                    placeholder="Eg. A1, B2, etc"
                    value={section}
                    onChange={(e) => setSection(formatSectionInput(e.target.value))}
                    maxLength={2}
                    disabled={step === 2}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white disabled:opacity-50 uppercase placeholder:normal-case"
                  />
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
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50"
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
