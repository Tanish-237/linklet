import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '../AdminDashboard';
import * as adminApi from '../../api/admin.api';
import * as AuthContextModule from '../../context/AuthContext';

vi.mock('../../api/admin.api', () => ({
  getBranches: vi.fn(),
  createBranch: vi.fn(),
  deleteBranch: vi.fn(),
  seedDefaultBranches: vi.fn(),
  getAdminStats: vi.fn(),
  getAdminUsers: vi.fn(),
  promoteUser: vi.fn(),
  setUserBanStatus: vi.fn(),
  getAdminContentOverview: vi.fn(),
  getAdminAuditLogs: vi.fn(),
  deleteAdminResource: vi.fn(),
  deleteAdminQuestion: vi.fn(),
  deleteAdminPost: vi.fn(),
  getReportedMessages: vi.fn(),
  updateReportStatus: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AdminDashboard Component Tests', () => {
  let queryClient;

  const mockAdminUser = {
    _id: 'admin_123',
    username: 'tanish_admin',
    fullName: 'Tanish Sharma',
    email: 'tanish@mnnit.ac.in',
    role: 'admin',
  };

  const mockStats = {
    users: { total: 250, admins: 3, students: 247 },
    resources: { total: 85, downloads: 1420 },
    community: { posts: 110, questions: 74, answers: 130, discussions: 204 },
    academic: { branches: 6 },
    updatedAt: new Date().toISOString(),
  };

  const mockUsersList = [
    {
      _id: 'student_1',
      username: 'rahul_verma',
      fullName: 'Rahul Verma',
      email: 'rahul.2023cs@mnnit.ac.in',
      role: 'user',
      semester: 4,
      branch: { _id: 'b1', name: 'Computer Science' },
    },
    {
      _id: 'admin_123', // Current Admin
      username: 'tanish_admin',
      fullName: 'Tanish Sharma',
      email: 'tanish@mnnit.ac.in',
      role: 'admin',
      semester: 6,
      branch: { _id: 'b1', name: 'Computer Science' },
    },
  ];

  const mockBranchesList = [
    { _id: 'b1', name: 'Computer Science and Engineering' },
    { _id: 'b2', name: 'Electronics and Communication' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockAdminUser,
    });

    adminApi.getAdminStats.mockResolvedValue(mockStats);
    adminApi.getAdminUsers.mockResolvedValue({
      success: true,
      data: mockUsersList,
      pagination: { totalDocs: 2, totalPages: 1, page: 1, limit: 10, hasNextPage: false },
    });
    adminApi.getBranches.mockResolvedValue(mockBranchesList);
    adminApi.getAdminContentOverview.mockResolvedValue({
      recentResources: [],
      recentQuestions: [],
      recentPosts: [],
    });
    adminApi.getAdminAuditLogs.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'log_1',
          adminId: { _id: 'admin_123', fullName: 'Tanish Sharma', username: 'tanish_admin', email: 'tanish@mnnit.ac.in' },
          action: 'USER_ROLE_CHANGE',
          targetType: 'User',
          targetId: 'student_1',
          details: { previousRole: 'user', newRole: 'admin' },
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { totalDocs: 1, totalPages: 1, page: 1, limit: 15 },
    });
    adminApi.getReportedMessages.mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'rep_1',
          reportedBy: { _id: 'u1', username: 'reporter_user', fullName: 'Reporter User' },
          senderId: { _id: 'u2', username: 'spammer_user', fullName: 'Spammer User' },
          reason: 'Harassment / Abusive content',
          messageContent: 'Inappropriate spam text',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { totalDocs: 1, totalPages: 1, page: 1, limit: 15 },
    });
    adminApi.updateReportStatus.mockResolvedValue({
      success: true,
      data: { _id: 'rep_1', status: 'reviewed' },
    });
  });

  const renderComponent = () =>
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AdminDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

  it('renders header, live status badge, and top KPI metric cards', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing Header and KPI cards render');
    renderComponent();

    // Verify header
    expect(screen.getByText('Platform Administration')).toBeInTheDocument();
    expect(screen.getByText('Admin Session Active')).toBeInTheDocument();

    // Verify stats cards loaded
    await waitFor(() => {
      expect(screen.getByText('247')).toBeInTheDocument(); // students
      expect(screen.getByText('85')).toBeInTheDocument();  // resources
      expect(screen.getByText('204')).toBeInTheDocument(); // discussions
      expect(screen.getByText('3')).toBeInTheDocument();   // admins
    });

    console.log('TRACE [AdminDashboard.test.jsx]: Verified all 4 platform KPI metrics');
  });

  it('renders user directory table with correct roles and disables self-demotion', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing User Directory table and self-demote guard');
    renderComponent();

    // Wait for user table to populate
    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
      expect(screen.getByText('@rahul_verma')).toBeInTheDocument();
      expect(screen.getByText('rahul.2023cs@mnnit.ac.in')).toBeInTheDocument();
    });

    // Verify student has "Promote" button
    const promoteBtn = screen.getByRole('button', { name: /Promote/i });
    expect(promoteBtn).toBeInTheDocument();
    expect(promoteBtn).not.toBeDisabled();

    // Verify self admin has "Current Account" button that is disabled
    const currentAccountBtn = screen.getByRole('button', { name: /Current Account/i });
    expect(currentAccountBtn).toBeInTheDocument();
    expect(currentAccountBtn).toBeDisabled();

    console.log('TRACE [AdminDashboard.test.jsx]: Confirmed self-demote prevention is disabled with label');
  });

  it('opens confirmation modal and executes role promotion for student', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing promotion confirmation modal flow');
    const user = userEvent.setup();
    adminApi.promoteUser.mockResolvedValueOnce({
      _id: 'student_1',
      username: 'rahul_verma',
      role: 'admin',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Promote/i })).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /Promote/i });
    await user.click(promoteBtn);

    // Verify modal appeared
    expect(screen.getByText('Promote to Administrator')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to change permissions for/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Role/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.promoteUser).toHaveBeenCalledWith('student_1', 'admin');
    });

    console.log('TRACE [AdminDashboard.test.jsx]: Promotion mutation called with correct arguments');
  });

  it('switches to Academic Departments tab and triggers quick seed MNNIT departments', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing Academic Departments tab and quick seed action');
    const user = userEvent.setup();
    adminApi.getBranches.mockResolvedValueOnce([]);
    adminApi.seedDefaultBranches.mockResolvedValueOnce({
      count: 9,
      branches: [
        { _id: 'b1', name: 'COMPUTER SCIENCE AND ENGINEERING' },
        { _id: 'b2', name: 'ELECTRONICS AND COMMUNICATION ENGINEERING' },
      ],
    });

    renderComponent();

    const branchesTab = screen.getByRole('tab', { name: /Academic Departments/i });
    await user.click(branchesTab);

    // Verify branch tab content
    expect(screen.getByText('Register Academic Department')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Department Name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Department/i })).toBeInTheDocument();

    // Verify Quick Seed button exists and click it
    const seedButtons = screen.getAllByRole('button', { name: /Quick Seed MNNIT Departments/i });
    expect(seedButtons[0]).toBeInTheDocument();
    await user.click(seedButtons[0]);

    await waitFor(() => {
      expect(adminApi.seedDefaultBranches).toHaveBeenCalled();
    });

    console.log('TRACE [AdminDashboard.test.jsx]: Quick seed triggered successfully');
  });

  it('opens suspension modal, inputs reason, and confirms user ban', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing user suspension flow');
    const user = userEvent.setup();
    adminApi.setUserBanStatus.mockResolvedValueOnce({
      _id: 'student_1',
      username: 'rahul_verma',
      isBanned: true,
      banReason: 'Spamming forum',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Rahul Verma')).toBeInTheDocument();
    });

    // Student has the active (not disabled) Suspend button
    const suspendButtons = screen.getAllByRole('button', { name: /Suspend/i });
    expect(suspendButtons[0]).not.toBeDisabled();
    await user.click(suspendButtons[0]);

    // Verify suspension modal opened
    expect(screen.getByText('Suspend Student Account')).toBeInTheDocument();
    const reasonInput = screen.getByPlaceholderText(/Violation of community code of conduct/i);
    await user.type(reasonInput, 'Spamming forum');

    const confirmSuspendBtn = screen.getByRole('button', { name: /Suspend Account/i });
    await user.click(confirmSuspendBtn);

    await waitFor(() => {
      expect(adminApi.setUserBanStatus).toHaveBeenCalledWith('student_1', true, 'Spamming forum');
    });

    console.log('TRACE [AdminDashboard.test.jsx]: User ban executed successfully');
  });

  it('switches to Security & Audit Trail tab and displays audit log activities', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing Audit Trail tab navigation');
    const user = userEvent.setup();
    renderComponent();

    const auditTab = screen.getByRole('tab', { name: /Security & Audit Trail/i });
    await user.click(auditTab);

    // Verify audit log table rendered
    await waitFor(() => {
      expect(screen.getByText('Platform Audit Trail')).toBeInTheDocument();
      expect(screen.getByText('USER_ROLE_CHANGE')).toBeInTheDocument();
      expect(screen.getByText('@tanish_admin')).toBeInTheDocument();
    });

    console.log('TRACE [AdminDashboard.test.jsx]: Audit trail logs rendered correctly');
  });

  it('switches to Reported Messages tab, displays reports, and allows resolving a report', async () => {
    console.log('TRACE [AdminDashboard.test.jsx]: Testing Reported Messages tab navigation and action');
    const user = userEvent.setup();
    renderComponent();

    const reportsTab = screen.getByRole('tab', { name: /Reported Messages/i });
    await user.click(reportsTab);

    // Verify reported message row rendered
    await waitFor(() => {
      expect(screen.getByText('Reported Chat Messages')).toBeInTheDocument();
      expect(screen.getByText('@reporter_user')).toBeInTheDocument();
      expect(screen.getByText('@spammer_user')).toBeInTheDocument();
      expect(screen.getByText('Harassment / Abusive content')).toBeInTheDocument();
      expect(screen.getByText('Inappropriate spam text')).toBeInTheDocument();
    });

    // Click Resolve button
    const resolveBtn = screen.getByRole('button', { name: /Resolve/i });
    await user.click(resolveBtn);

    await waitFor(() => {
      expect(adminApi.updateReportStatus).toHaveBeenCalledWith('rep_1', 'reviewed');
    });

    console.log('TRACE [AdminDashboard.test.jsx]: Reported message successfully resolved');
  });
});
