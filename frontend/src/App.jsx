import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, useEffect } from "react";
import useAuthStore from "./store/useAuthStore";
import ProtectedRoute from "./components/ProtectedRoute";

// Core Layout
import { Navbar } from "./components/Navbar";
import Layout from "./pages/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { SocketProvider } from "./context/SocketContext";
import AppToaster from "./components/AppToaster";
import "./App.css";

// Route-level pages are code-split; see pages/lazyPages.js.
import {
  Home,
  LandingPage,
  Login,
  Register,
  ForgotPassword,
  Posts,
  PostDetail,
  CreatePost,
  Resource,
  ChatPage,
  Dashboard,
  HelpForum,
  AskQuestion,
  QuestionDetail,
  GamesAndVideos,
  AdminDashboard,
  Profile,
  Saved,
  Settings,
  NotFound,
  AboutPage,
  ContactPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
} from "./pages/lazyPages";

// Legacy-URL redirects: old links kept the "/dashboard" prefix on every
// authenticated page (e.g. /dashboard/chat, /dashboard/profile/:username).
// That prefix now only belongs to the dashboard overview itself, but bookmarks,
// shared links and old notifications may still point at the old paths, so
// each one below forwards to its new home instead of 404ing.
const LegacyProfileRedirect = () => {
  const { username } = useParams();
  return <Navigate to={`/profile${username ? `/${username}` : ""}`} replace />;
};

const LegacyQuestionRedirect = () => {
  const { questionId } = useParams();
  return <Navigate to={`/help/question/${questionId}`} replace />;
};

const LegacyHelpRedirect = () => {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/dashboard\/help/, "");
  return <Navigate to={`/help${rest}`} replace />;
};

function App() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <span className="text-sm font-medium text-fg-muted">Loading Linklet...</span>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <SocketProvider>
        <Router>
          <AppToaster />
          <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-fg-muted">Loading...</span>
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

            {/* Layout Routes — everything the authenticated app shell renders
                lives at a top-level path; only the dashboard overview itself
                keeps "/dashboard". */}
            <Route
              path="/admin"
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
              path="/profile/:username?"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
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
              path="/resource-hub"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Resource />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/help/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HelpForum />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/help/question/:questionId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuestionDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Saved />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Legacy "/dashboard/..." links (old bookmarks, shared links,
                notifications) redirect to their new top-level home. */}
            <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />
            <Route path="/dashboard/profile/:username?" element={<LegacyProfileRedirect />} />
            <Route path="/dashboard/settings" element={<Navigate to="/settings" replace />} />
            <Route path="/dashboard/global-search" element={<Navigate to="/resource-hub" replace />} />
            <Route path="/dashboard/help/*" element={<LegacyHelpRedirect />} />
            <Route path="/dashboard/question/:questionId" element={<LegacyQuestionRedirect />} />
            <Route path="/dashboard/bookmarks" element={<Navigate to="/saved" replace />} />
            <Route path="/dashboard/saved" element={<Navigate to="/saved" replace />} />
            <Route path="/dashboard/chat" element={<Navigate to="/chat" replace />} />
            <Route path="/global-search" element={<Navigate to="/resource-hub" replace />} />
            <Route path="/resources" element={<Navigate to="/resource-hub" replace />} />
            <Route path="/dashboard/resources" element={<Navigate to="/resource-hub" replace />} />

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
