import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import {
  getBranches,
  createBranch,
  deleteBranch,
  seedDefaultBranches,
  getAdminStats,
  getAdminUsers,
  promoteUser,
  setUserBanStatus,
  getAdminContentOverview,
  getAdminAuditLogs,
  deleteAdminResource,
  deleteAdminQuestion,
  deleteAdminPost,
} from '../api/admin.api';
import defaultAvatar from '../assets/default-avatar.png';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { user: currentAdmin } = useAuth();

  // Navigation Tabs: 'users', 'branches', 'content', 'audit'
  const [activeTab, setActiveTab] = useState('users');

  // User Directory State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(''); // '' (all), 'user', 'admin'
  const [currentPage, setCurrentPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState('');

  // Branch Management State
  const [newBranchName, setNewBranchName] = useState('');

  // Modals State
  const [roleModalUser, setRoleModalUser] = useState(null); // { user, targetRole }
  const [deleteBranchTarget, setDeleteBranchTarget] = useState(null); // { _id, name }
  const [banModalTarget, setBanModalTarget] = useState(null); // { user, isBanned }
  const [banReasonInput, setBanReasonInput] = useState('');
  const [deleteContentTarget, setDeleteContentTarget] = useState(null); // { type, id, title }

  // Audit Logs State
  const [auditPage, setAuditPage] = useState(1);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. Fetch Platform KPI Stats
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
    isRefetching: isStatsRefetching,
  } = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
    staleTime: 30000,
  });

  // 2. Fetch User Directory
  const {
    data: usersData,
    isLoading: isUsersLoading,
    refetch: refetchUsers,
    isRefetching: isUsersRefetching,
  } = useQuery({
    queryKey: ['adminUsers', debouncedSearch, roleFilter, branchFilter, currentPage],
    queryFn: () =>
      getAdminUsers({
        search: debouncedSearch,
        role: roleFilter,
        branch: branchFilter,
        page: currentPage,
        limit: 10,
      }),
    staleTime: 15000,
  });

  // 3. Fetch Academic Branches
  const {
    data: branches = [],
    isLoading: isBranchesLoading,
  } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: 60000,
  });

  // 4. Fetch Recent Content Overview
  const {
    data: contentOverview,
    isLoading: isContentLoading,
    refetch: refetchContent,
  } = useQuery({
    queryKey: ['adminContentOverview'],
    queryFn: getAdminContentOverview,
    staleTime: 30000,
    enabled: activeTab === 'content',
  });

  // 5. Fetch Audit Logs
  const {
    data: auditData,
    isLoading: isAuditLoading,
    refetch: refetchAuditLogs,
    isRefetching: isAuditRefetching,
  } = useQuery({
    queryKey: ['adminAuditLogs', auditPage],
    queryFn: () => getAdminAuditLogs({ page: auditPage, limit: 15 }),
    staleTime: 15000,
    enabled: activeTab === 'audit',
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  // Promote / Demote Mutation
  const promoteUserMutation = useMutation({
    mutationFn: ({ userId, role }) => promoteUser(userId, role),
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success(
        `User ${updatedUser?.username || 'account'} successfully updated to ${variables.role.toUpperCase()}`
      );
      setRoleModalUser(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update user role');
    },
  });

  // Suspend / Reactivate User Mutation
  const setUserBanMutation = useMutation({
    mutationFn: ({ userId, isBanned, banReason }) =>
      setUserBanStatus(userId, isBanned, banReason),
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success(
        variables.isBanned
          ? `User @${updatedUser?.username || 'account'} has been suspended`
          : `User @${updatedUser?.username || 'account'} has been reactivated`
      );
      setBanModalTarget(null);
      setBanReasonInput('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    },
  });

  // Create Branch Mutation
  const createBranchMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success('Academic department created successfully');
      setNewBranchName('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create department');
    },
  });

  // Seed Default Branches Mutation
  const seedBranchesMutation = useMutation({
    mutationFn: seedDefaultBranches,
    onSuccess: (seededBranches) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success(`Initialized ${seededBranches?.length || 9} standard MNNIT departments!`);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to seed departments');
    },
  });

  // Delete Branch Mutation
  const deleteBranchMutation = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success('Academic department removed successfully');
      setDeleteBranchTarget(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete department');
    },
  });

  // In-Dashboard Moderation Deletion Mutation
  const deleteContentMutation = useMutation({
    mutationFn: async ({ type, id }) => {
      if (type === 'resource') return await deleteAdminResource(id);
      if (type === 'question') return await deleteAdminQuestion(id);
      return await deleteAdminPost(id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminContentOverview'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
      toast.success(`${variables.type.toUpperCase()} removed from platform`);
      setDeleteContentTarget(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete content');
    },
  });

  // Handlers
  const handleCreateBranch = (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    createBranchMutation.mutate({ name: newBranchName.trim() });
  };

  const handleConfirmRoleChange = () => {
    if (!roleModalUser) return;
    promoteUserMutation.mutate({
      userId: roleModalUser.user._id,
      role: roleModalUser.targetRole,
    });
  };

  const handleConfirmBanToggle = () => {
    if (!banModalTarget) return;
    setUserBanMutation.mutate({
      userId: banModalTarget.user._id,
      isBanned: banModalTarget.isBanned,
      banReason: banReasonInput.trim(),
    });
  };

  const handleConfirmDeleteContent = () => {
    if (!deleteContentTarget) return;
    deleteContentMutation.mutate({
      type: deleteContentTarget.type,
      id: deleteContentTarget.id,
    });
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchUsers();
    if (activeTab === 'content') refetchContent();
    if (activeTab === 'audit') refetchAuditLogs();
    toast.info('Platform analytics refreshed');
  };

  const users = usersData?.data || [];
  const pagination = usersData?.pagination || { totalDocs: 0, totalPages: 1, page: 1, limit: 10 };
  const auditLogs = auditData?.data || [];
  const auditPagination = auditData?.pagination || { totalDocs: 0, totalPages: 1, page: 1, limit: 15 };

  const formatAuditDetails = (log) => {
    const { action, details = {}, targetType } = log;
    if (!details || Object.keys(details).length === 0) {
      return <span className="text-gray-500 italic text-xs">Standard operation</span>;
    }

    if (action === 'USER_ROLE_CHANGE') {
      return (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-gray-400">Role:</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-gray-300 border border-gray-700">
            {details.previousRole || 'user'}
          </span>
          <span className="material-icons text-[12px] text-gray-500">arrow_forward</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-500/40 font-semibold">
            {details.newRole}
          </span>
        </div>
      );
    }

    if (action === 'USER_BAN_CHANGE') {
      return details.isBanned ? (
        <div className="flex items-center gap-1.5 text-xs text-rose-300">
          <span className="material-icons text-xs text-rose-400">block</span>
          <span>Suspended: {details.banReason ? `"${details.banReason}"` : 'Administrative action'}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-emerald-300">
          <span className="material-icons text-xs text-emerald-400">lock_open</span>
          <span>Access reinstated</span>
        </div>
      );
    }

    if (action === 'BRANCH_CREATE') {
      return (
        <span className="text-xs text-gray-300">
          Created: <strong className="text-white">{details.branchName || details.name}</strong>
        </span>
      );
    }

    if (action === 'BRANCH_DELETE') {
      return (
        <span className="text-xs text-rose-300">
          Removed: <strong className="text-white">{details.branchName || details.name}</strong>
        </span>
      );
    }

    if (action === 'BRANCH_SEED_DEFAULTS') {
      return (
        <span className="text-xs text-amber-300 flex items-center gap-1">
          <span className="material-icons text-xs text-amber-400">bolt</span>
          <span>Seeded {details.count || 9} standard engineering departments</span>
        </span>
      );
    }

    if (action && action.includes('DELETE')) {
      return (
        <span className="text-xs text-gray-300">
          Removed {targetType}: <strong className="text-white truncate max-w-[200px] inline-block align-bottom">{details.title || details.caption || 'Item'}</strong>
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1 flex-wrap text-xs">
        {Object.entries(details).slice(0, 3).map(([k, v]) => (
          <span key={k} className="px-1.5 py-0.5 rounded bg-gray-800/90 text-gray-300 text-[10px] font-mono border border-gray-700/50">
            {k}: {String(v)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="admin-dashboard-container" id="admin-dashboard-page">
      <Helmet>
        <title>Platform Administration | Linklet</title>
      </Helmet>

      {/* Header Bar */}
      <div className="admin-header-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <span className="material-icons text-2xl">admin_panel_settings</span>
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Platform Administration</h1>
            </div>
            <p className="text-sm text-gray-400">
              Manage student permissions, institutional departments, content moderation, and audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Admin Session Active
            </span>
            <button
              onClick={handleRefreshAll}
              disabled={isStatsRefetching || isUsersRefetching}
              className="p-2.5 rounded-xl bg-gray-800/80 hover:bg-violet-900/30 border border-gray-700/60 hover:border-violet-500/40 text-gray-300 hover:text-white transition-all cursor-pointer flex items-center justify-center"
              title="Refresh platform metrics"
              aria-label="Refresh platform data"
            >
              <span className={`material-icons text-lg ${isStatsRefetching || isUsersRefetching ? 'animate-spin text-violet-400' : ''}`}>
                refresh
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Students */}
        <div className="admin-metric-card group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Registered Students</span>
            <span className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/20 group-hover:scale-110 transition-transform">
              <span className="material-icons text-xl">school</span>
            </span>
          </div>
          <div className="text-2xl font-black text-white mb-1">
            {isStatsLoading ? <span className="animate-pulse">...</span> : (stats?.users?.students ?? 0)}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="text-violet-400 font-medium">MNNIT Verified</span> accounts
          </div>
        </div>

        {/* Total Library Resources */}
        <div className="admin-metric-card group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Academic Library</span>
            <span className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <span className="material-icons text-xl">folder_shared</span>
            </span>
          </div>
          <div className="text-2xl font-black text-white mb-1">
            {isStatsLoading ? <span className="animate-pulse">...</span> : (stats?.resources?.total ?? 0)}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">{stats?.resources?.downloads ?? 0}</span> total downloads
          </div>
        </div>

        {/* Forum & Community */}
        <div className="admin-metric-card group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Help Forum & Posts</span>
            <span className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
              <span className="material-icons text-xl">forum</span>
            </span>
          </div>
          <div className="text-2xl font-black text-white mb-1">
            {isStatsLoading ? <span className="animate-pulse">...</span> : (stats?.community?.discussions ?? 0)}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="text-indigo-400 font-medium">{stats?.community?.posts ?? 0}</span> community posts
          </div>
        </div>

        {/* Platform Administrators */}
        <div className="admin-metric-card group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">System Admins</span>
            <span className="p-2 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <span className="material-icons text-xl">shield</span>
            </span>
          </div>
          <div className="text-2xl font-black text-white mb-1">
            {isStatsLoading ? <span className="animate-pulse">...</span> : (stats?.users?.admins ?? 0)}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            Across <span className="text-amber-400 font-medium">{branches.length}</span> departments
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="admin-tabs-nav" role="tablist">
        <button
          id="admin-tab-users"
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
          role="tab"
          aria-selected={activeTab === 'users'}
        >
          <span className="material-icons text-lg">manage_accounts</span>
          User Directory & Roles
        </button>
        <button
          id="admin-tab-branches"
          className={`admin-tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          onClick={() => setActiveTab('branches')}
          role="tab"
          aria-selected={activeTab === 'branches'}
        >
          <span className="material-icons text-lg">account_balance</span>
          Academic Departments ({branches.length})
        </button>
        <button
          id="admin-tab-content"
          className={`admin-tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
          role="tab"
          aria-selected={activeTab === 'content'}
        >
          <span className="material-icons text-lg">policy</span>
          Platform Oversight
        </button>
        <button
          id="admin-tab-audit"
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
          role="tab"
          aria-selected={activeTab === 'audit'}
        >
          <span className="material-icons text-lg">history_edu</span>
          Security & Audit Trail
        </button>
      </div>

      {/* ─── TAB 1: User Directory ────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter and Search Toolbar */}
          <div className="admin-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Bar with dedicated wrapper so icon never collides */}
              <div className="admin-search-wrapper flex-1">
                <span className="material-icons admin-search-icon text-lg">
                  search
                </span>
                <input
                  id="admin-user-search-input"
                  type="text"
                  placeholder="Search students by name, @mnnit.ac.in email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="admin-search-clear-btn"
                    title="Clear search"
                  >
                    <span className="material-icons text-base">close</span>
                  </button>
                )}
              </div>

              {/* Role Filters & Department Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl p-1 bg-gray-900/80 border border-gray-700/60 shadow-inner">
                  <button
                    onClick={() => { setRoleFilter(''); setCurrentPage(1); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      roleFilter === '' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    All Roles
                  </button>
                  <button
                    onClick={() => { setRoleFilter('user'); setCurrentPage(1); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      roleFilter === 'user' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Students
                  </button>
                  <button
                    onClick={() => { setRoleFilter('admin'); setCurrentPage(1); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      roleFilter === 'admin' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Admins
                  </button>
                </div>

                <div className="admin-select-wrapper">
                  <select
                    id="admin-branch-filter-select"
                    value={branchFilter}
                    onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
                    className="admin-select"
                  >
                    <option value="" className="bg-gray-900 text-white">All Departments</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id} className="bg-gray-900 text-white">
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-icons admin-select-arrow">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Table Card */}
          <div className="admin-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Student / User</th>
                    <th className="text-left">Institutional Email</th>
                    <th className="text-left">Department & Year</th>
                    <th className="text-left">Role</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isUsersLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-14 text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <span className="material-icons animate-spin text-3xl text-violet-400">refresh</span>
                          <span className="text-sm font-medium">Loading user directory...</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-14 text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <span className="material-icons text-4xl text-gray-600">group_off</span>
                          <span className="text-sm font-semibold text-white">No matching users found</span>
                          <span className="text-xs text-gray-400">
                            {debouncedSearch || roleFilter || branchFilter
                              ? 'Try adjusting your search query or reset active filters.'
                              : 'No registered student accounts in the platform yet.'}
                          </span>
                          {(debouncedSearch || roleFilter || branchFilter) && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setDebouncedSearch('');
                                setRoleFilter('');
                                setBranchFilter('');
                                setCurrentPage(1);
                              }}
                              className="mt-3 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 hover:text-white border border-gray-700/60 transition-colors cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((targetUser) => {
                      const isSelf = targetUser._id === currentAdmin?._id;
                      const isAdmin = targetUser.role === 'admin';
                      const isBanned = Boolean(targetUser.isBanned);

                      return (
                        <tr key={targetUser._id} className="hover:bg-gray-800/30 transition-colors">
                          <td>
                            <div className="flex items-center gap-3">
                              <img
                                src={targetUser.avatar || defaultAvatar}
                                alt={targetUser.username}
                                className="w-9 h-9 rounded-full border border-gray-700 object-cover"
                              />
                              <div>
                                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                                  {targetUser.fullName || targetUser.username}
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/30 text-violet-300 border border-violet-500/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">@{targetUser.username}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="text-sm font-medium text-gray-300">
                              {targetUser.email}
                            </div>
                          </td>
                          <td>
                            <div className="text-xs text-gray-300">
                              <span className="font-semibold">{targetUser.branch?.name || targetUser.department || 'General'}</span>
                              <div className="text-gray-500">
                                {targetUser.semester ? `Semester ${targetUser.semester}` : 'Academic Profile'}
                              </div>
                            </div>
                          </td>
                          <td>
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 border border-amber-500/40 text-amber-300">
                                <span className="material-icons text-xs">shield</span>
                                Administrator
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800/80 border border-gray-700/60 text-gray-300">
                                <span className="material-icons text-xs">person</span>
                                Student
                              </span>
                            )}
                          </td>
                          <td>
                            {isBanned ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 border border-rose-500/40 text-rose-300"
                                title={targetUser.banReason ? `Reason: ${targetUser.banReason}` : 'Account suspended'}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                Suspended
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Active
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Role Promote / Demote */}
                              {isAdmin ? (
                                <button
                                  onClick={() => setRoleModalUser({ user: targetUser, targetRole: 'user' })}
                                  disabled={isSelf || promoteUserMutation.isPending}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    isSelf
                                      ? 'bg-gray-800/50 text-gray-500 border border-gray-700/30 cursor-not-allowed'
                                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 cursor-pointer'
                                  }`}
                                  title={isSelf ? 'You cannot demote your own account' : 'Demote user to standard Student'}
                                >
                                  {isSelf ? 'Current Account' : 'Demote'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setRoleModalUser({ user: targetUser, targetRole: 'admin' })}
                                  disabled={promoteUserMutation.isPending}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-icons text-xs">add_moderator</span>
                                  Promote
                                </button>
                              )}

                              {/* Suspend / Reactivate */}
                              {isBanned ? (
                                <button
                                  onClick={() =>
                                    setUserBanMutation.mutate({
                                      userId: targetUser._id,
                                      isBanned: false,
                                      banReason: '',
                                    })
                                  }
                                  disabled={setUserBanMutation.isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1"
                                  title="Reactivate student account"
                                >
                                  <span className="material-icons text-xs">lock_open</span>
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setBanModalTarget({ user: targetUser, isBanned: true });
                                    setBanReasonInput('');
                                  }}
                                  disabled={isSelf || setUserBanMutation.isPending}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    isSelf
                                      ? 'opacity-40 cursor-not-allowed text-gray-500 border border-gray-800'
                                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer flex items-center gap-1'
                                  }`}
                                  title={isSelf ? 'You cannot suspend yourself' : 'Suspend user account'}
                                >
                                  <span className="material-icons text-xs">block</span>
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalDocs > 0 && (
              <div className="p-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 bg-gray-900/30">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-white">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-white">
                    {Math.min(pagination.page * pagination.limit, pagination.totalDocs)}
                  </span>{' '}
                  of <span className="font-semibold text-white">{pagination.totalDocs}</span> students
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isUsersLoading}
                    className="px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-300 transition-all flex items-center gap-1"
                  >
                    <span className="material-icons text-xs">chevron_left</span>
                    Previous
                  </button>

                  <span className="px-3 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/40 text-gray-300 font-medium">
                    Page {currentPage} of {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage >= pagination.totalPages || isUsersLoading}
                    className="px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-300 transition-all flex items-center gap-1"
                  >
                    Next
                    <span className="material-icons text-xs">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Academic Departments / Branches ──────────────────────── */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          {/* Add Department Card */}
          <div className="admin-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="material-icons text-violet-400 text-2xl">domain_add</span>
                <div>
                  <h3 className="text-base font-semibold text-white">Register Academic Department</h3>
                  <p className="text-xs text-gray-400">
                    Add new institutional branches or divisions to organize study resources and timetables.
                  </p>
                </div>
              </div>

              {/* One-Click Quick Seed Button (Only shown during initial setup when 0 departments exist) */}
              {branches.length === 0 && (
                <button
                  type="button"
                  id="admin-seed-branches-btn"
                  onClick={() => seedBranchesMutation.mutate()}
                  disabled={seedBranchesMutation.isPending}
                  className="px-3.5 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  title="Initialize all 9 standard engineering departments for MNNIT Allahabad"
                >
                  {seedBranchesMutation.isPending ? (
                    <>
                      <span className="material-icons animate-spin text-sm">refresh</span>
                      Initializing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-sm text-amber-400">bolt</span>
                      Quick Seed MNNIT Departments
                    </>
                  )}
                </button>
              )}
            </div>

            <form onSubmit={handleCreateBranch} className="flex flex-col sm:flex-row gap-3">
              <input
                id="admin-new-branch-name-input"
                type="text"
                placeholder="Department Name (e.g., Computer Science and Engineering, Mechanical)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
                className="admin-form-input flex-1"
              />
              <button
                id="admin-create-branch-submit-btn"
                type="submit"
                disabled={createBranchMutation.isPending || !newBranchName.trim()}
                className="admin-primary-btn whitespace-nowrap justify-center"
              >
                {createBranchMutation.isPending ? (
                  <>
                    <span className="material-icons animate-spin text-sm">refresh</span>
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-sm">add</span>
                    Create Department
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Department List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {isBranchesLoading ? (
              <div className="col-span-full py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                <span className="material-icons animate-spin text-2xl text-violet-400">refresh</span>
                <span className="text-sm">Loading academic departments...</span>
              </div>
            ) : branches.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 admin-card flex flex-col items-center justify-center">
                <span className="material-icons text-3xl text-gray-500 mb-2">account_balance</span>
                <p className="text-sm font-semibold text-white">No academic departments registered yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-md">
                  Click below to initialize all 9 standard MNNIT engineering departments in one click, or register them manually above.
                </p>
                <button
                  type="button"
                  id="admin-seed-branches-empty-btn"
                  onClick={() => seedBranchesMutation.mutate()}
                  disabled={seedBranchesMutation.isPending}
                  className="mt-4 px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Initialize all 9 standard engineering departments for MNNIT Allahabad"
                >
                  <span className="material-icons text-sm text-amber-400">bolt</span>
                  Quick Seed MNNIT Departments
                </button>
              </div>
            ) : (
              branches.map((b) => (
                <div key={b._id} className="admin-card flex items-center justify-between p-4 group hover:border-violet-500/30 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-xl bg-violet-600/10 text-violet-400 border border-violet-500/20 group-hover:scale-105 transition-transform">
                      <span className="material-icons text-lg">account_balance</span>
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{b.name}</h4>
                      <span className="text-[11px] text-gray-400">Department ID: {b._id.slice(-6)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setDeleteBranchTarget(b)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={`Delete ${b.name}`}
                    aria-label={`Delete ${b.name}`}
                  >
                    <span className="material-icons text-lg">delete_outline</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Platform Content Oversight ───────────────────────────── */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Resources */}
            <div className="admin-card">
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="material-icons text-lg">folder</span>
                  <h3 className="text-sm font-semibold text-white">Recent Resources</h3>
                </div>
                <span className="text-xs text-gray-500">Latest Uploads</span>
              </div>

              {isContentLoading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Loading resources...</div>
              ) : (contentOverview?.recentResources || []).length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">No resources uploaded yet</div>
              ) : (
                <div className="space-y-3">
                  {contentOverview.recentResources.map((res) => (
                    <div key={res._id} className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40 text-xs">
                      <div className="font-semibold text-gray-200 truncate mb-1">{res.title}</div>
                      <div className="flex items-center justify-between text-gray-400 text-[11px] mt-2">
                        <span>by {res.userId?.fullName || res.userId?.username || 'Student'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-medium">{res.downloadsCount || 0} dl</span>
                          <button
                            onClick={() =>
                              setDeleteContentTarget({
                                type: 'resource',
                                id: res._id,
                                title: res.title,
                              })
                            }
                            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Resource (Moderation)"
                          >
                            <span className="material-icons text-sm">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Questions */}
            <div className="admin-card">
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2 text-violet-400">
                  <span className="material-icons text-lg">help_outline</span>
                  <h3 className="text-sm font-semibold text-white">Recent Questions</h3>
                </div>
                <span className="text-xs text-gray-500">Help Forum</span>
              </div>

              {isContentLoading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Loading discussions...</div>
              ) : (contentOverview?.recentQuestions || []).length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">No questions asked yet</div>
              ) : (
                <div className="space-y-3">
                  {contentOverview.recentQuestions.map((q) => (
                    <div key={q._id} className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40 text-xs">
                      <div className="font-semibold text-gray-200 truncate mb-1">{q.title}</div>
                      <div className="flex items-center justify-between text-gray-400 text-[11px] mt-2">
                        <span>by {q.userId?.fullName || q.userId?.username || 'Student'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-violet-400 font-medium">{q.answersCount || 0} answers</span>
                          <button
                            onClick={() =>
                              setDeleteContentTarget({
                                type: 'question',
                                id: q._id,
                                title: q.title,
                              })
                            }
                            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Question (Moderation)"
                          >
                            <span className="material-icons text-sm">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Community Posts */}
            <div className="admin-card">
              <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <span className="material-icons text-lg">dynamic_feed</span>
                  <h3 className="text-sm font-semibold text-white">Recent Feed Posts</h3>
                </div>
                <span className="text-xs text-gray-500">Community</span>
              </div>

              {isContentLoading ? (
                <div className="py-8 text-center text-gray-400 text-xs">Loading posts...</div>
              ) : (contentOverview?.recentPosts || []).length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">No community posts yet</div>
              ) : (
                <div className="space-y-3">
                  {contentOverview.recentPosts.map((p) => (
                    <div key={p._id} className="p-3 bg-gray-800/40 rounded-xl border border-gray-700/40 text-xs">
                      <div className="font-semibold text-gray-200 line-clamp-1 mb-1">{p.caption || 'Photo update'}</div>
                      <div className="flex items-center justify-between text-gray-400 text-[11px] mt-2">
                        <span>by {p.userId?.fullName || p.userId?.username || 'User'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-medium">{p.upvotes?.length || 0} upvotes</span>
                          <button
                            onClick={() =>
                              setDeleteContentTarget({
                                type: 'post',
                                id: p._id,
                                title: p.caption || 'Community Post',
                              })
                            }
                            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Post (Moderation)"
                          >
                            <span className="material-icons text-sm">delete_outline</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Security & Audit Trail ────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="admin-card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
              <div>
                <h3 className="text-base font-semibold text-white">Platform Audit Trail</h3>
                <p className="text-xs text-gray-400">
                  Chronological history of administrative actions, user promotions, suspensions, and content moderation.
                </p>
              </div>
              <button
                onClick={() => refetchAuditLogs()}
                disabled={isAuditRefetching}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 text-gray-300 transition-colors cursor-pointer"
                title="Refresh audit logs"
              >
                <span className={`material-icons text-base ${isAuditRefetching ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="admin-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Timestamp</th>
                    <th className="text-left">Action</th>
                    <th className="text-left">Target Type</th>
                    <th className="text-left">Details</th>
                    <th className="text-left">Executed By</th>
                  </tr>
                </thead>
                <tbody>
                  {isAuditLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-icons animate-spin text-2xl text-violet-400">refresh</span>
                          <span className="text-sm">Loading security audit logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-icons text-3xl text-gray-500">history</span>
                          <span className="text-sm font-medium">No administrative audit records logged yet</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const admin = log.adminId || {};
                      const isBanAction = log.action?.includes('BAN');
                      const isDeleteAction = log.action?.includes('DELETE');
                      const isPromoteAction = log.action?.includes('PROMOTE');

                      return (
                        <tr key={log._id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isBanAction
                                  ? 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                                  : isDeleteAction
                                  ? 'bg-purple-950/70 border border-purple-500/40 text-purple-300'
                                  : isPromoteAction
                                  ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
                                  : 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="text-xs font-semibold text-gray-200">
                            {log.targetType} {log.targetId ? `(${log.targetId.slice(-6)})` : ''}
                          </td>
                          <td className="text-xs text-gray-300 max-w-sm">
                            {formatAuditDetails(log)}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <img
                                src={admin.avatar || defaultAvatar}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-gray-700"
                              />
                              <span className="text-xs font-medium text-gray-200">
                                @{admin.username || 'admin'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Audit Pagination */}
            {auditPagination.totalDocs > 0 && (
              <div className="p-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 bg-gray-900/30">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-white">
                    {(auditPagination.page - 1) * auditPagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-white">
                    {Math.min(auditPagination.page * auditPagination.limit, auditPagination.totalDocs)}
                  </span>{' '}
                  of <span className="font-semibold text-white">{auditPagination.totalDocs}</span> events
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage <= 1 || isAuditLoading}
                    className="px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-300 transition-all flex items-center gap-1"
                  >
                    <span className="material-icons text-xs">chevron_left</span>
                    Previous
                  </button>

                  <span className="px-3 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/40 text-gray-300 font-medium">
                    Page {auditPage} of {auditPagination.totalPages}
                  </span>

                  <button
                    onClick={() => setAuditPage((p) => Math.min(auditPagination.totalPages, p + 1))}
                    disabled={auditPage >= auditPagination.totalPages || isAuditLoading}
                    className="px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-gray-300 transition-all flex items-center gap-1"
                  >
                    Next
                    <span className="material-icons text-xs">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ROLE CHANGE CONFIRMATION MODAL ─────────────────────────────────── */}
      {roleModalUser && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setRoleModalUser(null); }}
        >
          <div className="admin-modal-card">
            <button
              type="button"
              onClick={() => setRoleModalUser(null)}
              className="admin-modal-close-btn"
              title="Close modal"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className={`p-3 rounded-2xl ${
                roleModalUser.targetRole === 'admin'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                <span className="material-icons text-2xl">
                  {roleModalUser.targetRole === 'admin' ? 'verified_user' : 'person_remove'}
                </span>
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {roleModalUser.targetRole === 'admin' ? 'Promote to Administrator' : 'Demote to Standard Student'}
                </h3>
                <p className="text-xs text-gray-400">Institutional Role Modification</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to change permissions for{' '}
              <strong className="text-white">
                {roleModalUser.user.fullName || roleModalUser.user.username}
              </strong>{' '}
              (@{roleModalUser.user.username}) to{' '}
              <strong className={roleModalUser.targetRole === 'admin' ? 'text-amber-400' : 'text-gray-300'}>
                {roleModalUser.targetRole === 'admin' ? 'Administrator' : 'Standard Student'}
              </strong>?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                disabled={promoteUserMutation.isPending}
                className="admin-secondary-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                disabled={promoteUserMutation.isPending}
                className={roleModalUser.targetRole === 'admin' ? 'admin-primary-btn' : 'admin-danger-btn'}
              >
                {promoteUserMutation.isPending ? 'Updating...' : 'Confirm Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BAN / SUSPEND CONFIRMATION MODAL ───────────────────────────────── */}
      {banModalTarget && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setBanModalTarget(null); }}
        >
          <div className="admin-modal-card">
            <button
              type="button"
              onClick={() => setBanModalTarget(null)}
              className="admin-modal-close-btn"
              title="Close modal"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <span className="material-icons text-2xl">block</span>
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Suspend Student Account</h3>
                <p className="text-xs text-gray-400">Account Deactivation & Restriction</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              Suspending{' '}
              <strong className="text-white">
                {banModalTarget.user.fullName || banModalTarget.user.username}
              </strong>{' '}
              (@{banModalTarget.user.username}) will immediately revoke session access and prevent further posts, comments, or downloads.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Reason for Suspension (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Violation of community code of conduct, spamming"
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                className="admin-form-input text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBanModalTarget(null)}
                disabled={setUserBanMutation.isPending}
                className="admin-secondary-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBanToggle}
                disabled={setUserBanMutation.isPending}
                className="admin-danger-btn"
              >
                {setUserBanMutation.isPending ? 'Suspending...' : 'Suspend Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONTENT CONFIRMATION MODAL ──────────────────────────────── */}
      {deleteContentTarget && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteContentTarget(null); }}
        >
          <div className="admin-modal-card">
            <button
              type="button"
              onClick={() => setDeleteContentTarget(null)}
              className="admin-modal-close-btn"
              title="Close modal"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <span className="material-icons text-2xl">delete_forever</span>
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Remove {deleteContentTarget.type.toUpperCase()}
                </h3>
                <p className="text-xs text-gray-400">Platform Moderation Action</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">"{deleteContentTarget.title}"</strong>? This action cannot be undone and will be logged in the audit trail.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteContentTarget(null)}
                disabled={deleteContentMutation.isPending}
                className="admin-secondary-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteContent}
                disabled={deleteContentMutation.isPending}
                className="admin-danger-btn"
              >
                {deleteContentMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE BRANCH CONFIRMATION MODAL ───────────────────────────────── */}
      {deleteBranchTarget && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteBranchTarget(null); }}
        >
          <div className="admin-modal-card">
            <button
              type="button"
              onClick={() => setDeleteBranchTarget(null)}
              className="admin-modal-close-btn"
              title="Close modal"
            >
              <span className="material-icons text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="p-3 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
                <span className="material-icons text-2xl">warning</span>
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Academic Department</h3>
                <p className="text-xs text-gray-400">Institutional Branch Removal</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to remove the{' '}
              <strong className="text-white">{deleteBranchTarget.name}</strong> department? Students assigned to this branch may have their profile filters affected.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteBranchTarget(null)}
                disabled={deleteBranchMutation.isPending}
                className="admin-secondary-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteBranchMutation.mutate(deleteBranchTarget._id)}
                disabled={deleteBranchMutation.isPending}
                className="admin-danger-btn"
              >
                {deleteBranchMutation.isPending ? 'Removing...' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
