import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Posts from "./pages/Posts";
import PostDetail from "./pages/PostDetail";
import CreatePost from "./pages/CreatePost";
import Resource from "./pages/Resource";
import { Navbar } from "./components/Navbar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ChatPage from "./pages/ChatPage";
import { SocketProvider } from "./context/SocketContext";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import HelpForum from "./pages/HelpForum";
import AskQuestion from "./pages/AskQuestion";
import QuestionDetail from "./pages/QuestionDetail";
import Layout from "./pages/Layout";

// Import static pages
import AboutPage from "./pages/static/AboutPage";
import BlogPage from "./pages/static/BlogPage";
import BlogPostDetail from "./pages/static/BlogPostDetail";
import CareersPage from "./pages/static/CareersPage";
import ContactPage from "./pages/static/ContactPage";
import PrivacyPolicy from "./pages/static/PrivacyPolicy";
import TermsOfService from "./pages/static/TermsOfService";
import CookiePolicy from "./pages/static/CookiePolicy";
import SecurityInfo from "./pages/static/SecurityInfo";
import PricingPage from "./pages/static/PricingPage";
import FAQPage from "./pages/static/FAQPage";

import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();

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

            {/* Layout Routes */}
            <Route
              path="/dashboard"
              element={
                <Layout>
                  <Dashboard />
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
        </Router>
      </SocketProvider>
    </HelmetProvider>
  );
}

export default App;
