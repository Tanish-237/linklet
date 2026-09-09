import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { handleApiError } from "../utlis/ErrorHandler";
import { useAuth } from "../context/AuthContext";
import { Helmet } from 'react-helmet-async';

import linkletLogo from '../assets/linklet-logo.png';
import { apiClient } from "../api/apiClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { fetchUser, setUser } = useAuth();

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    toast.info("Google sign in will be available soon!");
  };

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
        if (res.data?.accessToken) {
          localStorage.setItem("accessToken", res.data.accessToken);
        }
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
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Helmet>
        <title>Login | Linklet - Your Complete Learning Journey</title>
        <meta name="description" content="Log in to Linklet to continue your learning journey. Access your resources and connect with peers." />
        <meta property="og:title" content="Login | Linklet" />
        <meta property="og:description" content="Log in to continue your learning journey with Linklet." />
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
              to="/register"
              className="px-4 py-2 rounded-lg hover:bg-violet-900/30 transition-all border border-violet-500/30 hover:border-violet-500"
            >
              Register
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
                Welcome Back
              </h1>
              <p className="text-xl text-gray-300">
                Log in to continue your learning journey
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-md rounded-xl border border-violet-500/20 p-8">
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-800 rounded-lg mb-6 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="password">Password</label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-200 cursor-pointer group"
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
                  <Link to="/forgot-password" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
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

            <p className="mt-6 text-center text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-violet-400 hover:text-violet-300">
                Create one now
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
