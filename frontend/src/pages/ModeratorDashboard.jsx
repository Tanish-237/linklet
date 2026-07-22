import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingQueue, verifyResource } from '../api/moderator.api';
import useAuthStore from '../store/useAuthStore';
import { toast } from 'react-toastify';
import './ModeratorDashboard.css';

const ModeratorDashboard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  // Fetch Pending Resources
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['pendingResources'],
    queryFn: () => getPendingQueue(user.branch), // Assuming user object has branch populated or its ID
  });

  const verifyMutation = useMutation({
    mutationFn: ({ resourceId, action }) => verifyResource(resourceId, action, user.branch),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pendingResources'] });
      toast.success(`Resource ${variables.action.toLowerCase()}d successfully`);
    },
    onError: () => toast.error('Verification failed'),
  });

  if (isLoading) return <div className="loading-screen">Loading Queue...</div>;

  return (
    <div className="moderator-dashboard container">
      <h1>Verification Queue</h1>
      <p className="subtitle">Review pending resources for your branch</p>

      {queue.length === 0 ? (
        <div className="empty-state glass-panel">
          <h3>No pending resources!</h3>
          <p>Your queue is completely clear. Great job.</p>
        </div>
      ) : (
        <div className="queue-list">
          {queue.map((resource) => (
            <div key={resource._id} className="queue-card glass-panel hover-glow">
              <div className="resource-info">
                <h3>{resource.title}</h3>
                <p className="description">{resource.description}</p>
                
                <div className="meta">
                  <span className="tag">Type: {resource.fileType}</span>
                  <span>Submitted by: {resource.userId?.username}</span>
                </div>
                
                <a 
                  href={resource.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  View Resource File
                </a>
              </div>

              <div className="actions">
                <button 
                  className="btn-success"
                  onClick={() => verifyMutation.mutate({ resourceId: resource._id, action: 'Approve' })}
                  disabled={verifyMutation.isPending}
                >
                  Approve
                </button>
                <button 
                  className="btn-danger"
                  onClick={() => verifyMutation.mutate({ resourceId: resource._id, action: 'Reject' })}
                  disabled={verifyMutation.isPending}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModeratorDashboard;
