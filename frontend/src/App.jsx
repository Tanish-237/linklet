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
import HelpForum from "./pages/HelpForum";
import AskQuestion from "./pages/AskQuestion";
import QuestionDetail from "./pages/QuestionDetail";

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
          {/* Public routes with Navbar */}
          <Route path="/" element={<><Navbar /><LandingPage /></>} />
          <Route path="/home" element={<><Navbar /><Home /></>} />
          <Route path="/login" element={<><Navbar /><Login /></>} />
          <Route path="/register" element={<><Navbar /><Register /></>} />
          <Route path="/posts" element={<><Navbar /><Posts /></>} />
          <Route path="/posts/:postId" element={<><Navbar /><PostDetail /></>} />
          <Route path="/ask-question" element={<><Navbar /><AskQuestion /></>} />
          <Route path="/question/:questionId" element={<><Navbar /><QuestionDetail /></>} />

          {/* Dashboard Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/resources" element={<Dashboard />} />
          <Route path="/dashboard/help/*" element={<Dashboard />} />
          <Route path="/dashboard/question/:questionId" element={<Dashboard />} />
          <Route path="/dashboard/clubs" element={<Dashboard />} />
          <Route path="/dashboard/forums" element={<Dashboard />} />
          <Route path="/dashboard/chat" element={<Dashboard />} />

          {/* Static Pages */}
          <Route path="/about" element={<><Navbar /><AboutPage /></>} />
          <Route path="/blog" element={<><Navbar /><BlogPage /></>} />
          <Route path="/blog/:id" element={<><Navbar /><BlogPostDetail /></>} />
          <Route path="/careers" element={<><Navbar /><CareersPage /></>} />
          <Route path="/contact" element={<><Navbar /><ContactPage /></>} />
          <Route path="/privacy" element={<><Navbar /><PrivacyPolicy /></>} />
          <Route path="/terms" element={<><Navbar /><TermsOfService /></>} />
          <Route path="/cookies" element={<><Navbar /><CookiePolicy /></>} />
          <Route path="/security" element={<><Navbar /><SecurityInfo /></>} />
          <Route path="/pricing" element={<><Navbar /><PricingPage /></>} />
          <Route path="/faq" element={<><Navbar /><FAQPage /></>} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;