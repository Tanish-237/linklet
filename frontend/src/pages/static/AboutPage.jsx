import React from 'react';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-8">About Linklet</h1>
        <div className="space-y-6 text-gray-300">
          <p>
            Linklet is a comprehensive learning platform designed to empower students and professionals in their educational journey.
            Founded with the vision of making quality education accessible and engaging, we strive to create an ecosystem where
            learning becomes a collaborative and enriching experience.
          </p>
          <p>
            Our platform combines cutting-edge technology with proven educational methodologies to deliver an unmatched learning
            experience. Whether you're a student looking to excel in your studies or a professional aiming to upgrade your skills,
            Linklet provides the tools and resources you need to succeed.
          </p>
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-violet-400 mb-4">Our Mission</h2>
            <p>
              To transform education through technology and make quality learning resources accessible to everyone,
              fostering a community of lifelong learners and innovators.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;