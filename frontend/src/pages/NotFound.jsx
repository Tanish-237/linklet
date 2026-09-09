import React from "react";
import { useNavigate } from "react-router-dom";
import linkletLogo from "../assets/linklet-logo.png";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-gray-900/60 backdrop-blur-xl border border-violet-500/20 rounded-2xl p-8 text-center shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <img
              src={linkletLogo}
              alt="Linklet Logo"
              className="w-16 h-16 rounded-full object-cover border border-violet-500/40 shadow-lg"
            />
            <span className="absolute -bottom-1 -right-1 bg-violet-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              404
            </span>
          </div>
        </div>

        <h1 className="text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300 mb-2">
          404
        </h1>
        <h2 className="text-xl font-bold text-gray-100 mb-3">
          Page Not Found
        </h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          The page you are looking for might have been moved, renamed, or does not exist in Linklet's campus network.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl border border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-all duration-200 cursor-pointer"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate("/home")}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-violet-600/25 transition-all duration-200 cursor-pointer"
          >
            Return to Feed
          </button>
        </div>
      </div>

      <p className="relative z-10 mt-8 text-xs text-gray-600">
        Linklet Campus Social &bull; All systems operational
      </p>
    </div>
  );
};

export default NotFound;
