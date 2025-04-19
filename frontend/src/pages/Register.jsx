import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { handleApiError } from "../utlis/ErrorHandler";
import { Helmet } from 'react-helmet-async';
import axios from "axios";
import linkletLogo from '../assets/linklet-logo.png';

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const navigate = useNavigate();
  const { fetchUser } = useAuth();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoogleSignup = () => {
    // TODO: Implement Google OAuth
    toast.info("Google sign up will be available soon!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("username", username);
      formData.append("password", password);
      formData.append("fullName", fullName);
      if (avatar) {
        formData.append("avatar", avatar);
      }

      const res = await axios.post(
        "http://localhost:5000/api/register",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
        { withCredentials: true }
      );

      if (res.status === 201) {
        toast.success("Registration successful! Please login.");
        await fetchUser();
        navigate("/login");
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Helmet>
        <title>Register | Linklet - Your Complete Learning Journey</title>
        <meta name="description" content="Join Linklet to start your learning journey. Connect with peers, access resources, and excel in your studies." />
        <meta property="og:title" content="Register | Linklet" />
        <meta property="og:description" content="Join Linklet to start your learning journey." />
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="fullName">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300" htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white"
                  />
                </div>

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
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-lg outline-none transition-all text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Profile Picture (Optional)</label>
                  <div 
                    onClick={() => document.getElementById('avatar-input').click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-violet-500/30 rounded-lg cursor-pointer hover:border-violet-500/50 transition-all bg-gray-900/50"
                  >
                    {avatarPreview ? (
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-violet-500 mb-2">
                        <img
                          src={avatarPreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <>
                        <span className="material-icons text-3xl text-violet-400 mb-2">cloud_upload</span>
                        <p className="text-sm text-gray-400">Click to upload a profile picture</p>
                      </>
                    )}
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Create Account
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-gray-400">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-violet-400 hover:text-violet-300">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-violet-400 hover:text-violet-300">
                Privacy Policy
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
