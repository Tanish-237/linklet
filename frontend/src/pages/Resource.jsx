import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Resource = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadFormData, setUploadFormData] = useState({
        title: '',
        description: '',
        tags: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    
    // Fetch resources on initial load
    useEffect(() => {
        fetchResources();
    }, []);
    
    // Real backend API call to fetch resources
    const fetchResources = async (query = '') => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:3000/api/resources${query ? `?search=${query}` : ''}`);
            setResources(response.data.data || []);
        } catch (error) {
            console.error('Error fetching resources:', error);
            alert('Failed to load resources. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            fetchResources(searchTerm);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        const allowedTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];
        
        if (file && allowedTypes.includes(file.type)) {
            setSelectedFile(file);
        } else {
            alert('Please select a valid document (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)');
        }
    };

    const handleUploadFormChange = (e) => {
        const { name, value } = e.target;
        setUploadFormData({ ...uploadFormData, [name]: value });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile || !uploadFormData.title || !uploadFormData.description) {
            alert('Please fill in all required fields and select a file');
            return;
        }

        setIsUploading(true);
        
        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('title', uploadFormData.title);
        formData.append('description', uploadFormData.description);
        formData.append('resourcetags', uploadFormData.tags);

        try {
            const response = await axios.post('http://localhost:3000/api/resources', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });

            if (response.data.success) {
                alert('Resource uploaded successfully!');
                setSelectedFile(null);
                setUploadFormData({ title: '', description: '', tags: '' });
                setShowUploadModal(false);  // Close the modal on success
                // Refresh the resources list
                fetchResources();
            }
        } catch (error) {
            console.error('Upload error:', error);
            if (error.response?.data?.message) {
                alert(`Upload failed: ${error.response.data.message}`);
            } else {
                alert('Upload failed. Please try again later.');
            }
        } finally {
            setIsUploading(false);
        }
    };

    // Modal component for upload form
    const UploadModal = () => {
        if (!showUploadModal) return null;
        
        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
                    <button 
                        onClick={() => setShowUploadModal(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    <h2 className="text-2xl font-bold text-white text-center mb-6">Share Your Resource</h2>
                    
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label className="block text-white mb-2">Title *</label>
                            <input
                                type="text"
                                name="title"
                                value={uploadFormData.title}
                                onChange={handleUploadFormChange}
                                placeholder="Enter a title for your resource"
                                className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-white mb-2">Description *</label>
                            <textarea
                                name="description"
                                value={uploadFormData.description}
                                onChange={handleUploadFormChange}
                                placeholder="Describe your resource"
                                className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-white mb-2">Tags (comma separated)</label>
                            <input
                                type="text"
                                name="tags"
                                value={uploadFormData.tags}
                                onChange={handleUploadFormChange}
                                placeholder="e.g. maths, mid-term, notes"
                                className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        
                        <div>
                            <label className="w-full p-3 bg-gray-700 text-white rounded-lg cursor-pointer text-center hover:bg-gray-600 transition block">
                                {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Document'}
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    required
                                />
                            </label>
                        </div>
                        
                        <button
                            type="submit"
                            disabled={isUploading || !selectedFile}
                            className={`w-full p-3 text-white rounded-lg transition ${
                                selectedFile ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'
                            }`}
                        >
                            {isUploading ? 'Uploading...' : 'Upload Document'}
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex flex-col items-center">
                {/* Main Resource Search Section */}
                <div className="w-full max-w-3xl p-6 bg-gray-800 rounded-lg shadow-lg mb-8">
                    <h1 className="text-3xl font-bold text-white text-center mb-6">Resource Library</h1>
                    
                    <div className="mb-6">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search resources..."
                            className="w-full p-4 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                        <button
                            onClick={handleSearch}
                            className="mt-3 w-full p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                            disabled={loading}
                        >
                            {loading ? 'Searching...' : 'Search Resources'}
                        </button>
                    </div>
                    
                    {/* "Do you have a resource to share?" button */}
                    <div className="mb-8 text-center">
                        <p className="text-gray-300 mb-2">Have a helpful document to share with others?</p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                        >
                            Share Your Resource
                        </button>
                    </div>
                    
                    {/* Results Section */}
                    <div className="mt-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">Resources</h2>
                        {loading ? (
                            <div className="flex justify-center items-center py-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : resources.length > 0 ? (
                            <div className="space-y-6">
                                {resources.map((resource) => (
                                    <div key={resource._id} className="p-5 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                                        <h3 className="text-xl font-semibold text-white">{resource.title}</h3>
                                        <p className="text-gray-300 mt-2">{resource.description}</p>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {resource.resourcetags?.map((tag, index) => (
                                                <span key={index} className="px-3 py-1 bg-blue-600 text-xs text-white rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <a 
                                            href={resource.fileUrl} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                                        >
                                            Download {resource.fileName || 'Document'}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-gray-300 text-lg">No resources found. Try a different search or share some documents!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Upload Modal */}
            <UploadModal />
        </div>
    );
};

export default Resource;