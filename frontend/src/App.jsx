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
const ModeratorDashboard = lazy(() => import("./pages/ModeratorDashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Saved = lazy(() => import("./pages/Saved"));
const Settings = lazy(() => import("./pages/Settings"));

// Lazy Loaded Static Pages
const AboutPage = lazy(() => import("./pages/static/AboutPage"));
const ContactPage = lazy(() => import("./pages/static/ContactPage"));

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
              path="/dashboard/clubs"
              element={
                <ProtectedRoute>
                  <Layout>
                    <div>Clubs Coming Soon</div>
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
            </Routes>
          </Suspense>
        </Router>
      </SocketProvider>
    </HelmetProvider>
  );
}

export default App;
