import React from 'react';
import { Link } from 'react-router-dom';

const BlogPage = () => {
  const blogPosts = [
    {
      id: 1,
      title: 'The Future of Online Learning in 2025',
      excerpt: 'Explore how AI, VR, and personalized learning paths are transforming education.',
      date: 'April 15, 2025',
      author: 'Sarah Chen',
      category: 'Education Technology',
      readTime: '5 min read',
      image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8'
    },
    {
      id: 2,
      title: 'How to Make the Most of Study Groups',
      excerpt: 'Tips and strategies for effective collaborative learning in virtual environments.',
      date: 'April 12, 2025',
      author: 'Michael Rodriguez',
      category: 'Study Tips',
      readTime: '4 min read',
      image: 'https://images.unsplash.com/photo-1515378960530-7c0da6231fb1'
    },
    {
      id: 3,
      title: 'The Impact of Microlearning',
      excerpt: 'Why breaking down complex topics into smaller chunks leads to better retention.',
      date: 'April 8, 2025',
      author: 'Emma Watson',
      category: 'Learning Science',
      readTime: '6 min read',
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173'
    },
    {
      id: 4,
      title: 'Building a Learning Routine That Sticks',
      excerpt: 'Practical advice for developing sustainable study habits in a busy world.',
      date: 'April 5, 2025',
      author: 'James Thompson',
      category: 'Productivity',
      readTime: '7 min read',
      image: 'https://images.unsplash.com/photo-1506784693919-ef06d93c28d2'
    }
  ];

  const categories = [
    'All',
    'Education Technology',
    'Study Tips',
    'Learning Science',
    'Productivity',
    'Student Life'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Linklet Blog
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Insights, tips, and stories about education, learning, and personal development.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-12 justify-center">
          {categories.map((category) => (
            <button
              key={category}
              className="px-4 py-2 rounded-lg bg-black/30 border border-gray-800 hover:border-violet-500/40 
              transition-colors text-gray-300 hover:text-violet-400"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl bg-black/30 backdrop-blur-md border border-gray-800 overflow-hidden 
              hover:border-violet-500/40 transition-all hover:-translate-y-1"
            >
              <div className="h-48 overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <span className="px-3 py-1 rounded-full bg-violet-900/30 text-violet-400 text-sm">
                    {post.category}
                  </span>
                  <span className="text-gray-400 text-sm">{post.readTime}</span>
                </div>

                <h2 className="text-2xl font-semibold text-violet-400 mb-3 hover:text-violet-300 transition-colors">
                  <Link to={`/blog/${post.id}`}>{post.title}</Link>
                </h2>
                
                <p className="text-gray-300 mb-4">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-900/30"></div>
                    <div>
                      <div className="font-medium text-violet-400">{post.author}</div>
                      <div className="text-sm text-gray-400">{post.date}</div>
                    </div>
                  </div>

                  <Link
                    to={`/blog/${post.id}`}
                    className="flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Read More
                    <span className="material-icons text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center">
          <button className="px-8 py-4 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold">
            Load More Articles
          </button>
        </div>

        <div className="mt-16 p-8 rounded-xl bg-violet-900/20 border border-violet-500/20 backdrop-blur-md text-center">
          <h2 className="text-2xl font-semibold text-violet-400 mb-4">Subscribe to Our Newsletter</h2>
          <p className="text-gray-300 mb-6">
            Get the latest articles, tips, and resources delivered straight to your inbox.
          </p>
          <div className="flex gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 bg-black/30 border border-gray-800 rounded-lg focus:outline-none 
              focus:border-violet-500 text-white placeholder-gray-500"
            />
            <button className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;