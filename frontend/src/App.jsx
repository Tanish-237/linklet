import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Posts from "./pages/Posts";
import PostDetail from "./pages/PostDetail";
import Resource from "./pages/Resource";
import { Navbar } from "./components/Navbar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import './App.css';
import Dashboard from './dashboard';

// Import static pages
import AboutPage from './pages/static/AboutPage';
import BlogPage from './pages/static/BlogPage';
import BlogPostDetail from './pages/static/BlogPostDetail';
import CareersPage from './pages/static/CareersPage';
import ContactPage from './pages/static/ContactPage';
import PrivacyPolicy from './pages/static/PrivacyPolicy';
import TermsOfService from './pages/static/TermsOfService';
import CookiePolicy from './pages/static/CookiePolicy';
import SecurityInfo from './pages/static/SecurityInfo';
import PricingPage from './pages/static/PricingPage';
import FAQPage from './pages/static/FAQPage';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <Navbar />
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
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<Register />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:postId" element={<PostDetail />} />
          <Route path="/resources" element={<Resource />} />
          
          {/* Static Pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:id" element={<BlogPostDetail />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/security" element={<SecurityInfo />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/faq" element={<FAQPage />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;