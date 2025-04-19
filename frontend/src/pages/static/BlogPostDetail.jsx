import React from 'react';
import { useParams, Link } from 'react-router-dom';

const BlogPostDetail = () => {
  const { id } = useParams();

  // Mock blog post data - in a real app, this would come from an API
  const post = {
    id: parseInt(id),
    title: 'The Future of Online Learning in 2025',
    content: `The landscape of online education is rapidly evolving, driven by technological advancements and changing learner needs. 
    As we move forward in 2025, several key trends are shaping how we learn and interact in virtual environments.

    Artificial Intelligence in Education
    AI is revolutionizing personalized learning by adapting content delivery to individual learning styles and pace. 
    Smart algorithms can now predict when a student might struggle with a concept and proactively offer additional resources or 
    alternative explanations.

    Virtual Reality Learning Environments
    Virtual Reality (VR) has transformed from a gaming technology into an essential educational tool. Students can now 
    take virtual field trips to historical sites, conduct chemistry experiments in safe virtual labs, or practice complex 
    surgical procedures without risk.

    Microlearning and Adaptive Pathways
    The traditional one-size-fits-all approach to education is giving way to more flexible, modular learning paths. 
    Students can now customize their educational journey based on their goals, schedule, and learning preferences.

    Social Learning and Collaboration
    Despite the digital nature of online learning, the importance of human connection remains paramount. New platforms 
    are emerging that facilitate meaningful peer-to-peer interaction and collaborative learning experiences.

    The Road Ahead
    As these technologies continue to evolve, we can expect even more innovative approaches to online education. 
    The key will be maintaining a balance between technological advancement and human connection, ensuring that 
    learning remains engaging, effective, and accessible to all.`,
    date: 'April 15, 2025',
    author: 'Sarah Chen',
    category: 'Education Technology',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8',
    tags: ['Education', 'Technology', 'AI', 'VR', 'Future of Learning']
  };

  const relatedPosts = [
    {
      id: 2,
      title: 'How to Make the Most of Study Groups',
      category: 'Study Tips',
      date: 'April 12, 2025'
    },
    {
      id: 3,
      title: 'The Impact of Microlearning',
      category: 'Learning Science',
      date: 'April 8, 2025'
    },
    {
      id: 4,
      title: 'Building a Learning Routine That Sticks',
      category: 'Productivity',
      date: 'April 5, 2025'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white pt-20 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/blog"
          className="inline-flex items-center text-violet-400 hover:text-violet-300 transition-colors mb-8"
        >
          <span className="material-icons mr-2">arrow_back</span>
          Back to Blog
        </Link>

        <article>
          <div className="rounded-xl overflow-hidden mb-8">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-[400px] object-cover"
            />
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <span className="px-3 py-1 rounded-full bg-violet-900/30 text-violet-400 text-sm">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">{post.readTime}</span>
            <span className="text-gray-400 text-sm">{post.date}</span>
          </div>

          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 mb-8 p-4 rounded-xl bg-black/30 backdrop-blur-md border border-gray-800">
            <div className="w-12 h-12 rounded-full bg-violet-900/30"></div>
            <div>
              <div className="font-medium text-violet-400">{post.author}</div>
              <div className="text-sm text-gray-400">Author & Education Technologist</div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            {post.content.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-gray-300 mb-6">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mt-8">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors cursor-pointer"
              >
                #{tag}
              </span>
            ))}
          </div>
        </article>

        <div className="mt-16 p-8 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-6">Related Articles</h2>
          <div className="space-y-4">
            {relatedPosts.map(related => (
              <Link
                key={related.id}
                to={`/blog/${related.id}`}
                className="block p-4 rounded-lg bg-black/30 border border-gray-800 hover:border-violet-500/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-violet-400 hover:text-violet-300 transition-colors">
                      {related.title}
                    </h3>
                    <div className="text-sm text-gray-400 mt-1">
                      {related.category} • {related.date}
                    </div>
                  </div>
                  <span className="material-icons text-violet-400">arrow_forward</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-16 p-8 rounded-xl bg-violet-900/20 backdrop-blur-md border border-violet-500/20">
          <h2 className="text-2xl font-semibold text-violet-400 mb-6">Share Your Thoughts</h2>
          <div className="space-y-4">
            <textarea
              placeholder="Write a comment..."
              rows={4}
              className="w-full px-4 py-3 bg-black/30 border border-gray-800 rounded-lg focus:outline-none 
              focus:border-violet-500 text-white placeholder-gray-500 resize-none"
            />
            <button className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold">
              Post Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPostDetail;