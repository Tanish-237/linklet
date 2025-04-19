import React from 'react';

const SecurityInfo = () => {
  const sections = [
    {
      title: 'Data Protection',
      content: `We employ industry-standard encryption and security measures to protect your personal data. All sensitive 
      information is encrypted using TLS/SSL technology, and we regularly update our security protocols to address new 
      threats and vulnerabilities.`,
      icon: 'shield'
    },
    {
      title: 'Account Security',
      content: `We offer two-factor authentication and strong password requirements to protect your account. Regular security 
      audits are performed to ensure the integrity of our authentication systems.`,
      icon: 'lock'
    },
    {
      title: 'Infrastructure Security',
      content: `Our platform is hosted on secure cloud infrastructure with multiple layers of protection against DDoS attacks, 
      intrusion attempts, and other security threats. We maintain regular backups and have disaster recovery procedures in place.`,
      icon: 'security'
    },
    {
      title: 'Privacy Compliance',
      content: `We adhere to international data protection regulations including GDPR and CCPA. Our security practices are 
      regularly reviewed and updated to ensure compliance with evolving privacy standards.`,
      icon: 'verified_user'
    },
    {
      title: 'Vulnerability Management',
      content: `We maintain a responsible disclosure program and work with security researchers to identify and fix potential 
      vulnerabilities. Our development team follows secure coding practices and regularly updates dependencies to patch 
      security issues.`,
      icon: 'bug_report'
    }
  ];

  const guidelines = [
    'Use strong, unique passwords for your account',
    'Enable two-factor authentication when available',
    'Never share your login credentials',
    'Be cautious of phishing attempts',
    'Regularly review your account activity',
    'Keep your devices and browsers updated'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">Security</h1>
        
        <div className="mb-8 text-gray-300">
          <p className="mb-4">
            At Linklet, we prioritize the security of your data and privacy. Learn about our security measures
            and best practices for protecting your account.
          </p>
        </div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800">
              <div className="flex items-start gap-4">
                <span className="material-icons text-3xl text-violet-400">{section.icon}</span>
                <div>
                  <h2 className="text-2xl font-semibold text-violet-400 mb-4">{section.title}</h2>
                  <p className="text-gray-300 whitespace-pre-line">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Security Guidelines</h2>
          <ul className="space-y-3">
            {guidelines.map((guideline, index) => (
              <li key={index} className="flex items-center gap-3 text-gray-300">
                <span className="material-icons text-violet-400">check_circle</span>
                {guideline}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Report a Security Issue</h2>
          <p className="text-gray-300 mb-4">
            If you discover a security vulnerability, please report it to our security team immediately.
          </p>
          <div className="space-y-2 text-gray-300">
            <p>Email: security@linklet.edu</p>
            <p>PGP Key: [Security Team PGP Key Fingerprint]</p>
            <button className="mt-4 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
              Submit Security Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityInfo;