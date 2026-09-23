import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { handleApiError } from "../utlis/ErrorHandler";
import { useAuth } from "../context/AuthContext";
import { Helmet } from 'react-helmet-async';

import linkletLogo from '../assets/linklet-logo.webp';
import { apiClient } from "../api/apiClient";
import GoogleAuthButton from "../components/GoogleAuthButton";
import SEO from "../components/SEO";
import ThemeToggle from "../theme/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { fetchUser, setUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.post(
        `/auth/login`,
        {
          email,
          password,
        }
      );
      
      if (res.status === 200) {
        toast.success("Welcome back!");
        if (res.data?.user) {
          setUser(res.data.user);
        }
        await fetchUser();
        navigate("/home");
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-canvas text-fg">
      {/* Sign-in screens have no search value; noindex keeps them out of results. */}
      <SEO title="Log in | Linklet" description="Log in to Linklet with your MNNIT account to access your campus feed, schedule, resources and chats." path="/login" noindex />
      <Helmet>
        <meta name="theme-color" content="#6D28D9" />
      </Helmet>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md shadow-soft border-b border-line">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img src={linkletLogo} alt="Linklet Logo" className="h-10 w-10" />
              <span className="text-2xl font-semibold tracking-tight text-fg">
                Linklet
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg hover:bg-accent-soft transition-all border border-accent/30 hover:border-accent text-fg-secondary hover:text-fg"
              >
                Register
              </Link>
            </div>
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
              <h1 className="text-3xl sm:text-4xl font-semibold mb-3 tracking-tight text-fg">
                Welcome Back
              </h1>
              <p className="text-xl text-fg-secondary">
                Log in to continue your learning journey
              </p>
            </div>

            <div className="bg-surface/70 backdrop-blur-md rounded-xl border border-line shadow-pop p-8">
              <GoogleAuthButton mode="signin" />

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-line"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 py-0.5 bg-surface border border-line rounded-full text-xs font-medium text-fg-muted uppercase tracking-wider">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-fg-secondary" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-lg outline-none transition-all text-fg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-fg-secondary" htmlFor="password">Password</label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 bg-surface-2 border border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-lg outline-none transition-all text-fg"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 flex items-center justify-center w-7 h-7 rounded-md text-fg-subtle hover:text-accent-fg hover:bg-accent-soft transition-all duration-200 cursor-pointer group"
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

                <div className="flex items-center justify-end">
                  <Link to="/forgot-password" className="text-sm text-accent-fg hover:text-accent-fg transition-colors">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white rounded-lg font-medium tracking-wide shadow-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? "Logging in..." : "Log In"}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-fg-muted">
              Don't have an account?{' '}
              <Link to="/register" className="text-accent-fg hover:text-accent-fg">
                Create one now
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
