/// <reference types="@testing-library/jest-dom" />
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../pages/Dashboard';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useAuth context
const mockUser = { uid: 'test-user-id', displayName: 'Test User' };
const mockProfile = { onboarded: true, displayName: 'Test User', hasCompletedOnboarding: false };
const mockUpdateProfile = vi.fn().mockResolvedValue({});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    updateProfile: mockUpdateProfile,
  }),
}));

// Mock firebase APIs
const mockCreateSession = vi.fn().mockResolvedValue({});
vi.mock('../firebase', () => ({
  createSession: (...args: any[]) => mockCreateSession(...args),
  subscribeToUserSessions: vi.fn((_uid, cb) => {
    cb([]); // return empty sessions list initially
    return vi.fn(); // unsubscribe
  }),
  getUserFeedbackList: vi.fn().mockResolvedValue([]),
  getUserSoloSessions: vi.fn().mockResolvedValue([]),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  addToMatchmakingQueue: vi.fn(),
  removeFromMatchmakingQueue: vi.fn(),
  subscribeToQueueItem: vi.fn(),
  uploadAndParseResume: vi.fn(),
  optInToLeaderboard: vi.fn(),
  MOCK_MODE: true,
}));

// Mock lucide-react to avoid styling/icon load issues
vi.mock('lucide-react', () => ({
  Calendar: () => null,
  TrendingUp: () => null,
  Clock: () => null,
  Plus: () => null,
  Copy: () => null,
  Check: () => null,
  ArrowRight: () => null,
  Brain: () => null,
  Terminal: () => null,
  UserPlus: () => null,
  MessageSquare: () => null,
  Sparkles: () => null,
  Award: () => null,
  MoreHorizontal: () => null,
  CheckCircle2: () => null,
  Circle: () => null,
  X: () => null,
}));

// Mock Layout component to render children directly
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Dashboard Session Scheduling Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
  });

  test('validates form: rejects past dates and times', async () => {
    render(<Dashboard />);
    
    // Open the schedule session modal
    const scheduleBtns = screen.getAllByText(/Schedule Session/i);
    fireEvent.click(scheduleBtns[0]);

    // Select a date and time in the past
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } });
    fireEvent.change(timeInput, { target: { value: '12:00' } });

    // Submit the form
    const submitBtn = screen.getByText('Confirm session');
    fireEvent.click(submitBtn);

    // Verify alert was called with past date message
    expect(window.alert).toHaveBeenCalledWith('Session date and time cannot be in the past');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test('validates form: accepts future dates and times', async () => {
    render(<Dashboard />);
    
    // Open the schedule session modal
    const scheduleBtns = screen.getAllByText(/Schedule Session/i);
    fireEvent.click(scheduleBtns[0]);

    // Select a date and time in the future
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: '2030-12-31' } });
    fireEvent.change(timeInput, { target: { value: '15:00' } });

    // Submit the form
    const submitBtn = screen.getByText('Confirm session');
    fireEvent.click(submitBtn);

    // Verify session was created
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
  });
});
