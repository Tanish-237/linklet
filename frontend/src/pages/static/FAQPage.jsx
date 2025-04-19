import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQPage = () => {
  const [activeCategory, setActiveCategory] = useState('general');
  const [expandedItems, setExpandedItems] = useState([]);

  const categories = [
    { id: 'general', name: 'General' },
    { id: 'account', name: 'Account' },
    { id: 'payment', name: 'Payment' },
    { id: 'features', name: 'Features' },
    { id: 'support', name: 'Support' }
  ];

  const faqs = {
    general: [
      {
        question: 'What is Linklet?',
        answer: 'Linklet is a comprehensive learning platform designed to help students and professionals enhance their skills through structured learning paths, interactive content, and collaborative features.'
      },
      {
        question: 'Who can use Linklet?',
        answer: 'Linklet is suitable for students, professionals, educators, and organizations looking to enhance their learning experience or provide educational content.'
      },
      {
        question: 'Is Linklet available worldwide?',
        answer: 'Yes, Linklet is available globally. Our platform can be accessed from anywhere with an internet connection.'
      }
    ],
    account: [
      {
        question: 'How do I create an account?',
        answer: 'You can create an account by clicking the "Sign Up" button and following the registration process. You\'ll need to provide your email address and create a password.'
      },
      {
        question: 'Can I change my account settings?',
        answer: 'Yes, you can modify your account settings, including profile information, notification preferences, and privacy settings from your account dashboard.'
      },
      {
        question: 'How do I reset my password?',
        answer: 'Click the "Forgot Password" link on the login page, enter your email address, and follow the instructions sent to your email to reset your password.'
      }
    ],
    payment: [
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept major credit cards, PayPal, and bank transfers. For enterprise plans, we also offer invoice-based payments.'
      },
      {
        question: 'Can I cancel my subscription?',
        answer: 'Yes, you can cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing period.'
      },
      {
        question: 'Do you offer refunds?',
        answer: 'We offer a 30-day money-back guarantee for our Pro plan. Contact our support team for refund requests.'
      }
    ],
    features: [
      {
        question: 'What features are included in the free plan?',
        answer: 'The free plan includes access to basic learning resources, community forums, study groups, and limited storage space.'
      },
      {
        question: 'How does the progress tracking work?',
        answer: 'Our platform automatically tracks your progress through courses, assignments, and practice exercises. You can view detailed analytics in your dashboard.'
      },
      {
        question: 'Can I download content for offline use?',
        answer: 'Pro and Enterprise users can download content for offline access. Free users can only access content while connected to the internet.'
      }
    ],
    support: [
      {
        question: 'How can I get help?',
        answer: 'You can reach our support team through the help center, email support@linklet.edu, or live chat (Pro and Enterprise users).'
      },
      {
        question: 'What are your support hours?',
        answer: 'Our support team is available 24/7 for Enterprise users, and from 9 AM to 6 PM EST on weekdays for all other users.'
      },
      {
        question: 'Do you offer technical support?',
        answer: 'Yes, we provide technical support for platform-related issues. Enterprise users get priority support with dedicated technical assistance.'
      }
    ]
  };

  const toggleItem = (index) => {
    setExpandedItems(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
          Frequently Asked Questions
        </h1>

        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeCategory === category.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {faqs[activeCategory].map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-black/30 backdrop-blur-md border border-gray-800 overflow-hidden"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-lg font-semibold text-violet-400">{faq.question}</span>
                <span className="material-icons text-gray-400">
                  {expandedItems.includes(index) ? 'remove' : 'add'}
                </span>
              </button>
              
              {expandedItems.includes(index) && (
                <div className="p-6 pt-0 text-gray-300">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20 text-center">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Still Have Questions?</h2>
          <p className="text-gray-300 mb-6">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <Link
            to="/contact"
            className="inline-block px-8 py-4 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;