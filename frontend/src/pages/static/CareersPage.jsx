import React from 'react';

const CareersPage = () => {
  const jobs = [
    {
      id: 1,
      title: 'Senior Full Stack Developer',
      department: 'Engineering',
      location: 'Remote / New York',
      type: 'Full-time',
      description: 'Join our core team to build and scale our learning platform infrastructure.'
    },
    {
      id: 2,
      title: 'Product Manager',
      department: 'Product',
      location: 'Remote / San Francisco',
      type: 'Full-time',
      description: 'Lead product strategy and development for our educational technology solutions.'
    },
    {
      id: 3,
      title: 'Education Content Specialist',
      department: 'Content',
      location: 'Remote',
      type: 'Full-time',
      description: 'Create and curate high-quality educational content for our platform.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-8">Join Our Team</h1>
        
        <div className="mb-8 text-gray-300">
          <p className="mb-4">
            At Linklet, we're on a mission to transform education through technology.
            Join us in building the future of learning.
          </p>
        </div>

        <div className="grid gap-6">
          {jobs.map(job => (
            <div key={job.id} className="p-6 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800 hover:border-violet-500/40 transition-all">
              <div className="flex flex-wrap gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-violet-900/30 text-violet-400">{job.department}</span>
                <span className="px-3 py-1 rounded-full bg-purple-900/30 text-purple-400">{job.location}</span>
                <span className="px-3 py-1 rounded-full bg-gray-800 text-gray-300">{job.type}</span>
              </div>
              
              <h2 className="text-2xl font-semibold text-violet-400 mb-3">{job.title}</h2>
              <p className="text-gray-300 mb-4">{job.description}</p>
              
              <button className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                Apply Now
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Why Join Linklet?</h2>
          <ul className="space-y-3 text-gray-300">
            <li>🌟 Competitive salary and equity packages</li>
            <li>🏥 Comprehensive health and wellness benefits</li>
            <li>🎓 Learning and development stipend</li>
            <li>🏖️ Flexible PTO policy</li>
            <li>🌍 Remote-first culture</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CareersPage;