import React from 'react';

const CookiePolicy = () => {
  const sections = [
    {
      title: 'What Are Cookies',
      content: `Cookies are small text files that are stored on your device when you visit our website. They help us provide you 
      with a better experience by remembering your preferences, analyzing how you use our platform, and assisting with our 
      marketing efforts.`
    },
    {
      title: 'Types of Cookies We Use',
      subsections: [
        {
          subtitle: 'Essential Cookies',
          content: 'Required for the platform to function properly, including authentication and security.'
        },
        {
          subtitle: 'Preference Cookies',
          content: 'Remember your settings and preferences for a better experience.'
        },
        {
          subtitle: 'Analytics Cookies',
          content: 'Help us understand how visitors interact with our platform.'
        },
        {
          subtitle: 'Marketing Cookies',
          content: 'Track your online activity to help advertisers deliver more relevant advertising.'
        }
      ]
    },
    {
      title: 'Managing Cookies',
      content: `You can control and/or delete cookies as you wish. You can delete all cookies that are already on your device and 
      you can set most browsers to prevent them from being placed. However, if you do this, you may have to manually adjust some 
      preferences every time you visit our platform, and some services and functionalities may not work.`
    },
    {
      title: 'Third-Party Cookies',
      content: `Some cookies are placed by third-party services that appear on our pages. We use these services to enhance your 
      learning experience, provide social media features, and analyze our traffic. These third parties may use cookies for their 
      own purposes.`
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-8">Cookie Policy</h1>
        
        <div className="mb-8 text-gray-300">
          <p className="mb-4">
            Last updated: April 19, 2025
          </p>
          <p className="mb-4">
            This Cookie Policy explains how Linklet uses cookies and similar tracking technologies on our platform.
            Please read this policy carefully to understand how we use these technologies to provide you with a better experience.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800">
              <h2 className="text-2xl font-semibold text-violet-400 mb-4">{section.title}</h2>
              {section.content && (
                <p className="text-gray-300 whitespace-pre-line">{section.content}</p>
              )}
              {section.subsections && (
                <div className="mt-4 space-y-4">
                  {section.subsections.map((subsection, subIndex) => (
                    <div key={subIndex} className="pl-4 border-l-2 border-violet-500/30">
                      <h3 className="text-lg font-semibold text-violet-400 mb-2">{subsection.subtitle}</h3>
                      <p className="text-gray-300">{subsection.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Cookie Preferences</h2>
          <p className="text-gray-300 mb-4">
            You can manage your cookie preferences at any time through your browser settings.
          </p>
          <button className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
            Manage Cookie Settings
          </button>
        </div>

        <div className="mt-8 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions about our Cookie Policy, please contact us at:
          </p>
          <ul className="mt-4 space-y-2 text-gray-300">
            <li>Email: privacy@linklet.edu</li>
            <li>Address: 123 Learning Street, San Francisco, CA 94105</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;