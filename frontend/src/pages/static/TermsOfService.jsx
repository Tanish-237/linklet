import React from 'react';

const TermsOfService = () => {
  const sections = [
    {
      title: 'Acceptance of Terms',
      content: `By accessing or using Linklet's platform, you agree to be bound by these Terms of Service. If you do not agree 
      to these terms, please do not use our services. We reserve the right to modify these terms at any time, and your 
      continued use of the platform constitutes acceptance of any modifications.`
    },
    {
      title: 'User Accounts',
      content: `You must be at least 13 years old to use our services. You are responsible for maintaining the security of your 
      account credentials and for all activities that occur under your account. You agree to provide accurate and complete 
      information when creating your account and to update this information as needed.`
    },
    {
      title: 'User Conduct',
      content: `You agree to use our platform in accordance with all applicable laws and regulations. You will not engage in any 
      activity that interferes with or disrupts the services, or impairs other users' ability to use the platform. This includes 
      but is not limited to: spreading malware, spamming, or harvesting user data without consent.`
    },
    {
      title: 'Content Guidelines',
      content: `Users may submit, upload, or share content through our platform. You retain ownership of your content, but grant 
      us a worldwide, non-exclusive license to use, reproduce, and distribute your content in connection with our services. 
      You are solely responsible for your content and must not violate any third-party rights.`
    },
    {
      title: 'Intellectual Property',
      content: `All content and materials available through our platform, including but not limited to text, graphics, logos, 
      images, and software, are the property of Linklet or our licensors and are protected by copyright, trademark, and other 
      intellectual property laws.`
    },
    {
      title: 'Termination',
      content: `We reserve the right to suspend or terminate your account and access to our services at our discretion, without 
      notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties, or for any 
      other reason.`
    },
    {
      title: 'Limitation of Liability',
      content: `To the maximum extent permitted by law, Linklet shall not be liable for any indirect, incidental, special, 
      consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any 
      loss of data, use, goodwill, or other intangible losses.`
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">Terms of Service</h1>
        
        <div className="mb-8 text-gray-300">
          <p className="mb-4">
            Last updated: April 19, 2025
          </p>
          <p className="mb-4">
            Please read these Terms of Service carefully before using the Linklet platform. These terms constitute
            a legally binding agreement between you and Linklet regarding your use of our services.
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
            If you have any questions about these Terms of Service, please contact our legal team at:
          </p>
          <ul className="mt-4 space-y-2 text-gray-300">
            <li>Email: legal@linklet.edu</li>
            <li>Address: 123 Learning Street, San Francisco, CA 94105</li>
            <li>Phone: +1 (555) 123-4567</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;