import React from 'react';
import { Link } from 'react-router-dom';

const PricingPage = () => {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for getting started with learning',
      features: [
        'Access to basic learning resources',
        'Join study groups',
        'Basic progress tracking',
        'Community forum access',
        'Limited storage (500MB)'
      ],
      buttonText: 'Get Started',
      isPopular: false
    },
    {
      name: 'Pro',
      price: '$12',
      period: 'per month',
      description: 'Ideal for serious learners',
      features: [
        'Everything in Free plan',
        'Advanced analytics and insights',
        'Priority support',
        'Offline access',
        'Unlimited storage',
        'Private study groups',
        'AI-powered recommendations'
      ],
      buttonText: 'Start Pro Trial',
      isPopular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'per organization',
      description: 'For organizations and institutions',
      features: [
        'Everything in Pro plan',
        'Custom integrations',
        'Dedicated support',
        'Admin dashboard',
        'User management',
        'Advanced security features',
        'Custom branding'
      ],
      buttonText: 'Contact Sales',
      isPopular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
            Choose Your Learning Journey
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Select a plan that best fits your learning needs. All plans include access to our core features.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-xl ${
                plan.isPopular
                  ? 'bg-violet-900/30 border-2 border-violet-500'
                  : 'bg-black/30 border border-gray-800'
              } backdrop-blur-md transition-transform hover:scale-105`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-violet-400 mb-2">{plan.name}</h2>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-400">/{plan.period}</span>
                </div>
                <p className="text-gray-300">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-300">
                    <span className="material-icons text-violet-400">check_circle</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                className={`block text-center px-6 py-3 rounded-lg font-semibold transition-colors ${
                  plan.isPopular
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {plan.buttonText}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-xl bg-violet-900/20 border border-violet-500/20 backdrop-blur-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-violet-400 mb-4">Need Something Different?</h2>
            <p className="text-gray-300 mb-6">
              We offer custom solutions for educational institutions and organizations.
              Contact our sales team to discuss your specific requirements.
            </p>
            <Link
              to="/contact"
              className="inline-block px-8 py-4 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold"
            >
              Contact Sales
            </Link>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-violet-400 mb-4">Trusted by Leading Institutions</h3>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            <div className="w-32 h-12 bg-gray-800/50 rounded-lg"></div>
            <div className="w-32 h-12 bg-gray-800/50 rounded-lg"></div>
            <div className="w-32 h-12 bg-gray-800/50 rounded-lg"></div>
            <div className="w-32 h-12 bg-gray-800/50 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;