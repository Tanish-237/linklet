import React, { Component } from "react";
import linkletLogo from "../assets/linklet-logo.webp";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-md w-full bg-gray-900/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <img
                  src={linkletLogo}
                  alt="Linklet Logo"
                  className="w-14 h-14 rounded-full object-cover border border-red-500/40"
                />
                <span className="material-icons absolute -bottom-1 -right-1 bg-red-600 text-white text-xs p-1 rounded-full">
                  warning
                </span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              An unexpected error occurred while rendering this view. Your session and account are secure.
            </p>

            {this.state.error?.message && (
              <div className="p-3 mb-6 bg-black/40 border border-red-500/20 rounded-xl text-left text-xs text-red-300 font-mono break-words max-h-28 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all duration-200 cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-xl border border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
