import React from "react";
import Sidebar from "./pages/Sidebar";
import MainContent from "./pages/MainContent";

export default function Dashboard() {
  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white">
      <Sidebar />
      <MainContent />
    </div>
  );
}
