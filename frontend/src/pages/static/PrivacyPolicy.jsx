import React from 'react';

const PrivacyPolicy = () => {
  const sections = [
    {
      title: 'Information We Collect',
      content: `We collect information that you provide directly to us, including when you create an account, 
      update your profile, or interact with our platform. This may include your name, email address, educational background, 
      and learning preferences. We also automatically collect certain information about your device and how you interact with our platform.`
    },
    {
      title: 'How We Use Your Information',
      content: `We use the information we collect to provide, maintain, and improve our services, 
      to communicate with you, and to personalize your learning experience. This includes recommending relevant courses, 
      connecting you with study partners, and providing progress analytics.`
    },
    {
      title: 'Information Sharing',
      content: `We do not sell your personal information to third parties. We may share your information with service providers 
      who assist in our operations, with your consent, or when required by law. We may also share aggregated or de-identified 
      information that cannot reasonably be used to identify you.`
    },
    {
      title: 'Security',
      content: `We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, 
      disclosure, alteration, and destruction. However, no security system is impenetrable, and we cannot guarantee the security 
      of our systems.`
    },
    {
      title: 'Your Rights and Choices',
      content: `You can access, update, or delete your account information at any time through your account settings. 
      You can also opt-out of marketing communications while still receiving important service-related notifications.`
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">Privacy Policy</h1>
        
        <div className="mb-8 text-gray-300">
          <p className="mb-4">
            Last updated: April 19, 2025
          </p>
          <p className="mb-4">
            At Linklet, we take your privacy seriously. This Privacy Policy explains how we collect, use, 
            disclose, and safeguard your information when you use our platform.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800">
              <h2 className="text-2xl font-semibold text-violet-400 mb-4">{section.title}</h2>
              <p className="text-gray-300 whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <ul className="mt-4 space-y-2 text-gray-300">
            <li>Email: privacy@linklet.edu</li>
            <li>Address: 123 Learning Street, San Francisco, CA 94105</li>
            <li>Phone: +1 (555) 123-4567</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;