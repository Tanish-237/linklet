import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Suspense, lazy, useEffect } from "react";
import useAuthStore from "./store/useAuthStore";
import ProtectedRoute from "./components/ProtectedRoute";

// Core Layout
import { Navbar } from "./components/Navbar";
import Layout from "./pages/Layout";
import { SocketProvider } from "./context/SocketContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

// Lazy Loaded Pages
const Home = lazy(() => import("./pages/Home"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
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
const ModeratorDashboard = lazy(() => import("./pages/ModeratorDashboard"));
const Profile = lazy(() => import("./pages/Profile"));

// Lazy Loaded Static Pages
const AboutPage = lazy(() => import("./pages/static/AboutPage"));
const BlogPage = lazy(() => import("./pages/static/BlogPage"));
const BlogPostDetail = lazy(() => import("./pages/static/BlogPostDetail"));
const CareersPage = lazy(() => import("./pages/static/CareersPage"));
const ContactPage = lazy(() => import("./pages/static/ContactPage"));
const PrivacyPolicy = lazy(() => import("./pages/static/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/static/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/static/CookiePolicy"));
const SecurityInfo = lazy(() => import("./pages/static/SecurityInfo"));
const PricingPage = lazy(() => import("./pages/static/PricingPage"));
const FAQPage = lazy(() => import("./pages/static/FAQPage"));

function App() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <div className="loading-screen">Loading Linklet...</div>; // Could be a beautiful spinner
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
          <Suspense fallback={<div className="loading-screen">Loading Page...</div>}>
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
              element={user ? <Home /> : <Navigate to="/login" replace />}
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
              path="/games"
              element={
                <>
                  <Navbar />
                  <GamesAndVideos />
                </>
              }
            />

            {/* Public routes with Navbar */}
            <Route
              path="/posts"
              element={
                <>
                  <Navbar />
                  <Posts />
                </>
              }
            />
            <Route
              path="/posts/:postId"
              element={
                <>
                  <Navbar />
                  <PostDetail />
                </>
              }
            />
            <Route
              path="/create-post"
              element={
                user ? (
                  <>
                    <Navbar />
                    <CreatePost />
                  </>
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/ask-question"
              element={
                <>
                  <Navbar />
                  <AskQuestion />
                </>
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
              element={
                user ? (
                  <Navigate to={`/dashboard/profile`} replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
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
              path="/dashboard/moderator"
              element={
                <ProtectedRoute allowedRoles={['admin', 'moderator']}>
                  <Layout>
                    <ModeratorDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/dashboard/profile/:username?"
              element={
                <Layout>
                  <Profile />
                </Layout>
              }
            />
            <Route
              path="/dashboard/resources"
              element={
                <Layout>
                  <Resource />
                </Layout>
              }
            />
            <Route
              path="/dashboard/help/*"
              element={
                <Layout>
                  <HelpForum />
                </Layout>
              }
            />
            <Route
              path="/dashboard/question/:questionId"
              element={
                <Layout>
                  <QuestionDetail />
                </Layout>
              }
            />
            <Route
              path="/dashboard/clubs"
              element={
                <Layout>
                  <div>Clubs Coming Soon</div>
                </Layout>
              }
            />
            <Route path="/dashboard/chat" element={<ChatPage />} />

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
              path="/blog"
              element={
                <>
                  <Navbar />
                  <BlogPage />
                </>
              }
            />
            <Route
              path="/blog/:id"
              element={
                <>
                  <Navbar />
                  <BlogPostDetail />
                </>
              }
            />
            <Route
              path="/careers"
              element={
                <>
                  <Navbar />
                  <CareersPage />
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
                  <PrivacyPolicy />
                </>
              }
            />
            <Route
              path="/terms"
              element={
                <>
                  <Navbar />
                  <TermsOfService />
                </>
              }
            />
            <Route
              path="/cookies"
              element={
                <>
                  <Navbar />
                  <CookiePolicy />
                </>
              }
            />
            <Route
              path="/security"
              element={
                <>
                  <Navbar />
                  <SecurityInfo />
                </>
              }
            />
            <Route
              path="/pricing"
              element={
                <>
                  <Navbar />
                  <PricingPage />
                </>
              }
            />
            <Route
              path="/faq"
              element={
                <>
                  <Navbar />
                  <FAQPage />
                </>
              }
            />
            </Routes>
          </Suspense>
        </Router>
      </SocketProvider>
    </HelmetProvider>
  );
}

export default App;
