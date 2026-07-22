import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBranches, createBranch, promoteUser, deleteBranch } from '../api/admin.api';
import { toast } from 'react-toastify';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [newBranchName, setNewBranchName] = useState('');
  
  // User Promotion State
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteRole, setPromoteRole] = useState('user');
  const [promoteBranchId, setPromoteBranchId] = useState('');

  // Fetch Branches
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
  });

  // Mutations
  const createBranchMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch created successfully');
      setNewBranchName('');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create branch'),
  });

  const deleteBranchMutation = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success('Branch deleted');
    },
    onError: () => toast.error('Failed to delete branch'),
  });

  const promoteUserMutation = useMutation({
    mutationFn: ({ userId, role, branchId }) => promoteUser(userId, role, branchId),
    onSuccess: () => {
      toast.success('User role updated successfully');
      setPromoteUserId('');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update user role'),
  });

  const handleCreateBranch = (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    createBranchMutation.mutate({ name: newBranchName.trim() });
  };

  const handlePromoteUser = (e) => {
    e.preventDefault();
    if (!promoteUserId.trim()) return;
    promoteUserMutation.mutate({
      userId: promoteUserId.trim(),
      role: promoteRole,
      branchId: promoteRole === 'moderator' ? promoteBranchId : null,
    });
  };

  if (isLoading) return <div className="loading-screen">Loading Admin Dashboard...</div>;

  return (
    <div className="admin-dashboard container">
      <h1>Admin Dashboard</h1>

      <div className="dashboard-grid">
        {/* Branch Management Section */}
        <section className="glass-panel dashboard-card">
          <h2>Manage Branches</h2>
          
          <form onSubmit={handleCreateBranch} className="branch-form">
            <input
              type="text"
              placeholder="New Branch Name (e.g. CS)"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary" disabled={createBranchMutation.isPending}>
              {createBranchMutation.isPending ? 'Adding...' : 'Add Branch'}
            </button>
          </form>

          <ul className="branch-list">
            {branches.map((branch) => (
              <li key={branch._id} className="branch-item">
                <span>{branch.name}</span>
                <button 
                  onClick={() => deleteBranchMutation.mutate(branch._id)}
                  className="btn-danger btn-small"
                  disabled={deleteBranchMutation.isPending}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* User Promotion Section */}
        <section className="glass-panel dashboard-card">
          <h2>Manage User Roles</h2>
          <form onSubmit={handlePromoteUser} className="promotion-form">
            <input
              type="text"
              placeholder="User ID"
              value={promoteUserId}
              onChange={(e) => setPromoteUserId(e.target.value)}
              required
            />
            
            <select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)}>
              <option value="user">Normal User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>

            {promoteRole === 'moderator' && (
              <select 
                value={promoteBranchId} 
                onChange={(e) => setPromoteBranchId(e.target.value)}
                required
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            )}

            <button type="submit" className="btn-primary" disabled={promoteUserMutation.isPending}>
              {promoteUserMutation.isPending ? 'Updating...' : 'Update Role'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
