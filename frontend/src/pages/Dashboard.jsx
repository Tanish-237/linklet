import React from "react";
import Layout from "./Layout";
import { useLocation } from "react-router-dom";
import AttendanceTracker from "../components/AttendanceTracker";
import DailySchedule from "../components/DailySchedule";
import Resource from "./Resource";
import HelpForum from "./HelpForum";
import QuestionDetail from "./QuestionDetail";

export default function Dashboard() {
  const location = useLocation();

  const renderMainContent = () => {
    const path = location.pathname;
    
    if (path === '/dashboard/resources') {
      return <Resource />;
    }

    if (path.startsWith('/dashboard/help')) {
      return <HelpForum basePath="/dashboard" />;
    }

    if (path.startsWith('/dashboard/question/')) {
      return <QuestionDetail basePath="/dashboard" />;
    }

    // Default dashboard content
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "help", title: "Questions", count: 15 },
            { icon: "library_books", title: "Resources", count: 25 },
            { icon: "forum", title: "Forums", count: 5 },
            { icon: "groups", title: "Clubs", count: 3 },
            { icon: "school", title: "Study", count: 8 },
            { icon: "stars", title: "Activity", count: 12 },
          ].map(({ icon, title, count }) => (
            <div key={title} className="bg-violet-900/20 backdrop-blur-md rounded-lg shadow-lg p-6 hover:scale-[1.02] transform transition-all duration-300 border border-gray-800">
              <div className="flex items-center space-x-3">
                <span className="material-icons text-2xl text-violet-400">{icon}</span>
                <h2 className="text-2xl font-bold text-violet-400">{title}</h2>
              </div>
              <p className="text-4xl font-bold mt-4 text-right">{count}</p>
            </div>
          ))}
        </div>
        
        <div className="mt-8 space-y-8">
          <DailySchedule />
          <AttendanceTracker />
        </div>
      </>
    );
  };

  return (
    <Layout>
      {renderMainContent()}
    </Layout>
  );
}