import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from "react-toastify";

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
    
    useEffect(() => {
        fetchResources();
    }, []);
    
    const fetchResources = async (query = '') => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:3000/api/resources${query ? `?search=${query}` : ''}`);
            setResources(response.data.data || []);
        } catch (error) {
            console.error('Error fetching resources:', error);
            toast.error('Failed to load resources. Please try again later.');
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
            toast.error('Please select a valid document (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)');
        }
    };

    const handleUploadFormChange = (e) => {
        const { name, value } = e.target;
        setUploadFormData({ ...uploadFormData, [name]: value });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile || !uploadFormData.title || !uploadFormData.description) {
            toast.error('Please fill in all required fields and select a file');
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
                toast.success('Resource uploaded successfully!');
                setSelectedFile(null);
                setUploadFormData({ title: '', description: '', tags: '' });
                setShowUploadModal(false);
                fetchResources();
            }
        } catch (error) {
            console.error('Upload error:', error);
            if (error.response?.data?.message) {
                toast.error(`Upload failed: ${error.response.data.message}`);
            } else {
                toast.error('Upload failed. Please try again later.');
            }
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-600">
                    Resource Library
                </h1>
                <p className="text-gray-400 mt-2">
                    Discover and share valuable learning resources with your peers
                </p>
            </div>

            {/* Search and Upload Section */}
            <div className="mb-8">
                <div className="bg-gray-900/50 backdrop-blur-md border border-violet-500/20 rounded-xl p-6 shadow-xl">
                    <div className="relative mb-6">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search resources..."
                            className="w-full p-4 pl-12 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                        />
                        <span className="material-icons absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                            search
                        </span>
                        <button
                            onClick={handleSearch}
                            className="mt-3 w-full p-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-icons text-xl">manage_search</span>
                                    <span>Search Resources</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="text-center">
                        <p className="text-gray-300 mb-3">Have a helpful document to share with others?</p>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 font-semibold flex items-center gap-2 mx-auto"
                        >
                            <span className="material-icons">upload_file</span>
                            Share Your Resource
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            <div className="space-y-6">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-violet-500/20 border-t-violet-500"></div>
                    </div>
                ) : resources.length > 0 ? (
                    <div className="grid gap-6">
                        {resources.map((resource) => (
                            <div 
                                key={resource._id} 
                                className="p-6 bg-gray-900/50 backdrop-blur-md border border-violet-500/20 rounded-xl hover:border-violet-500/40 transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-semibold text-white group-hover:text-violet-400 transition-colors">
                                            {resource.title}
                                        </h3>
                                        <p className="text-gray-300 mt-2 mb-4">{resource.description}</p>
                                    </div>
                                    <a 
                                        href={resource.fileUrl} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600 hover:text-white transition-all"
                                    >
                                        <span className="material-icons text-xl">download</span>
                                        Download
                                    </a>
                                </div>
                                
                                {resource.resourcetags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {resource.resourcetags.map((tag, index) => (
                                            <span 
                                                key={index} 
                                                className="px-3 py-1 bg-violet-900/30 text-violet-300 text-sm rounded-full border border-violet-500/30"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-900/30 rounded-xl border border-violet-500/20">
                        <span className="material-icons text-4xl text-gray-500 mb-4">folder_off</span>
                        <p className="text-gray-400 text-lg">No resources found. Try a different search or share some documents!</p>
                    </div>
                )}
            </div>
            
            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="bg-gray-900/95 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-violet-500/30">
                        <button 
                            onClick={() => setShowUploadModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="material-icons">close</span>
                        </button>
                        
                        <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
                            Share Your Resource
                        </h2>
                        
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-gray-300 mb-2 text-sm">Title *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={uploadFormData.title}
                                    onChange={handleUploadFormChange}
                                    placeholder="Enter a title for your resource"
                                    className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-gray-300 mb-2 text-sm">Description *</label>
                                <textarea
                                    name="description"
                                    value={uploadFormData.description}
                                    onChange={handleUploadFormChange}
                                    placeholder="Describe your resource"
                                    className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all min-h-[100px]"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-gray-300 mb-2 text-sm">Tags (comma separated)</label>
                                <input
                                    type="text"
                                    name="tags"
                                    value={uploadFormData.tags}
                                    onChange={handleUploadFormChange}
                                    placeholder="e.g. maths, mid-term, notes"
                                    className="w-full p-3 bg-black/30 text-white rounded-lg border border-violet-500/30 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all"
                                />
                            </div>
                            
                            <div>
                                <label className="block w-full p-4 bg-black/30 text-white rounded-lg cursor-pointer border border-violet-500/30 hover:border-violet-500 transition-all text-center group">
                                    <span className="material-icons text-2xl mb-2 text-violet-400 group-hover:text-violet-300">
                                        {selectedFile ? 'check_circle' : 'upload_file'}
                                    </span>
                                    <span className="block text-sm">
                                        {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Document'}
                                    </span>
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
                                className={`w-full p-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                                    selectedFile 
                                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white' 
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {isUploading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                                        <span>Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons">cloud_upload</span>
                                        <span>Upload Document</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Resource;