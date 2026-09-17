import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useParams,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, lazy, useEffect } from "react";
import useAuthStore from "./store/useAuthStore";
import ProtectedRoute from "./components/ProtectedRoute";

// Core Layout
import { Navbar } from "./components/Navbar";
import Layout from "./pages/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { SocketProvider } from "./context/SocketContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// Lazy Loaded Pages
const Home = lazy(() => import("./pages/Home"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Posts = lazy(() => import("./pages/Posts"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const Resource = lazy(() => import("./pages/Resource"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const HelpForum = lazy(() => import("./pages/HelpForum"));
const AskQuestion = lazy(() => import("./pages/AskQuestion"));
const QuestionDetail = lazy(() => import("./pages/QuestionDetail"));
const GamesAndVideos = lazy(() => import("./pages/GamesAndVideos"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Saved = lazy(() => import("./pages/Saved"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy Loaded Static Pages
const AboutPage = lazy(() => import("./pages/static/AboutPage"));
const ContactPage = lazy(() => import("./pages/static/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/static/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/static/TermsOfServicePage"));

const ProfileRedirect = () => {
  const { username } = useParams();
  const { user } = useAuthStore();
  
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/dashboard/profile${username ? `/${username}` : ""}`} replace />;
};

function App() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <span className="text-sm font-medium text-gray-400">Loading Linklet...</span>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <SocketProvider>
        <Router>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
          <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-gray-500">Loading...</span>
              </div>
            }
          >
            <Routes>
            {/* Redirect to home if logged in, otherwise show landing page */}
            <Route
              path="/"
              element={
                user ? (
                  <Navigate to="/home" replace />
                ) : (
                  <>
                    <Navbar />
                    <LandingPage />
                  </>
                )
              }
            />

            {/* Protected Home route */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />

            {/* Auth routes - redirect to home if already logged in */}
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/home" replace />
                ) : (
                  <>
                    <Navbar />
                    <Login />
                  </>
                )
              }
            />
            <Route
              path="/register"
              element={
                user ? (
                  <Navigate to="/home" replace />
                ) : (
                  <>
                    <Navbar />
                    <Register />
                  </>
                )
              }
            />
            <Route
              path="/forgot-password"
              element={
                user ? (
                  <Navigate to="/home" replace />
                ) : (
                  <ForgotPassword />
                )
              }
            />
            <Route
              path="/games"
              element={
                <>
                  <Navbar />
                  <GamesAndVideos />
                </>
              }
            />

            {/* Public routes with consistent Layout */}
            <Route
              path="/posts"
              element={
                <Layout>
                  <Posts />
                </Layout>
              }
            />
            <Route
              path="/posts/:postId"
              element={
                <Layout>
                  <PostDetail />
                </Layout>
              }
            />
            <Route
              path="/create-post"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <CreatePost />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ask-question"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <AskQuestion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/question/:questionId"
              element={
                <>
                  <Navbar />
                  <QuestionDetail />
                </>
              }
            />

            {/* Redirect old /profile route to dashboard */}
            <Route
              path="/profile/:username?"
              element={<ProfileRedirect />}
            />

            {/* Redirect legacy /global-search and /resources paths to protected dashboard route */}
            <Route
              path="/global-search"
              element={<Navigate to="/dashboard/global-search" replace />}
            />
            <Route
              path="/resources"
              element={<Navigate to="/dashboard/global-search" replace />}
            />

            {/* Layout Routes */}
            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/profile/:username?"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/global-search"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Resource />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/help/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HelpForum />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/question/:questionId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuestionDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/bookmarks"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Saved />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/saved"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Saved />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/chat"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={<Navigate to="/dashboard/chat" replace />}
            />

            {/* Static Pages */}
            <Route
              path="/about"
              element={
                <>
                  <Navbar />
                  <AboutPage />
                </>
              }
            />
            <Route
              path="/contact"
              element={
                <>
                  <Navbar />
                  <ContactPage />
                </>
              }
            />
            <Route
              path="/privacy"
              element={
                <>
                  <Navbar />
                  <PrivacyPolicyPage />
                </>
              }
            />
            <Route
              path="/terms"
              element={
                <>
                  <Navbar />
                  <TermsOfServicePage />
                </>
              }
            />

            {/* 404 Catch-All Route */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </Router>
      </SocketProvider>
    </HelmetProvider>
  );
}

export default App;
