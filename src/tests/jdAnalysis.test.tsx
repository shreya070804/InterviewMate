/// <reference types="@testing-library/jest-dom" />
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { JDAnalysis } from '../pages/JDAnalysis';
import { saveJDAnalysis } from '../firebase';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useAuth context to return a logged-in user
const mockUser = { uid: 'test-user-id', displayName: 'Test User' };
const mockProfile = { onboarded: true, displayName: 'Test User', resumeText: 'React, TypeScript, JavaScript, Algorithms' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    updateProfile: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock firebase helper functions
vi.mock('../firebase', () => ({
  getUserFeedbackList: vi.fn().mockResolvedValue([
    {
      topic: 'DSA - Trees',
      scores: { correctness: 8, efficiency: 7, communication: 9 }
    }
  ]),
  saveJDAnalysis: vi.fn().mockImplementation((_userId, payload) => Promise.resolve({
    id: 'analysis_123',
    createdAt: new Date().toISOString(),
    ...payload
  })),
  getJDAnalyses: vi.fn().mockResolvedValue([
    {
      id: 'past_analysis_1',
      createdAt: '2026-06-18T10:00:00Z',
      jdText: 'Looking for a React developer with Python skills.',
      matched_skills: ['React'],
      missing_skills: ['Python'],
      weak_categories_for_this_role: ['Frontend'],
      recommendation: 'Update your resume.'
    }
  ]),
  showToast: vi.fn(),
  MOCK_MODE: true
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
  AlertTriangle: () => null,
  Play: () => null,
  History: () => null,
  BookOpen: () => null,
  ChevronRight: () => null,
  ArrowLeft: () => null,
  Loader2: () => null,
  FileText: () => null
}));

// Mock Layout component to render children directly
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('JDAnalysis Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders page structure, textarea, and history items', async () => {
    render(<JDAnalysis />);

    // Check header
    expect(screen.getByText('Job Description Gap Analysis')).toBeInTheDocument();

    // Check textarea presence
    expect(screen.getByPlaceholderText(/Paste the job description you're applying for here.../i)).toBeInTheDocument();

    // Check loading of past analysis in history sidebar
    await waitFor(() => {
      expect(screen.getByText(/Looking for a React developer with Python/)).toBeInTheDocument();
    });
  });

  test('submits job description and renders comparison results', async () => {
    render(<JDAnalysis />);

    const textarea = screen.getByPlaceholderText(/Paste the job description you're applying for here.../i);
    fireEvent.change(textarea, { target: { value: 'We need a React and Python developer.' } });

    const analyzeBtn = screen.getByRole('button', { name: /Analyze Alignment/i });
    fireEvent.click(analyzeBtn);

    // Verify save helper was called
    await waitFor(() => {
      expect(saveJDAnalysis).toHaveBeenCalled();
    });

    // Verify it transitions to results view
    await waitFor(() => {
      expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
      expect(screen.getByText('What matches')).toBeInTheDocument();
      expect(screen.getByText('What\'s missing')).toBeInTheDocument();
      expect(screen.getByText('What to practice')).toBeInTheDocument();
    });
  });

  test('selecting a past analysis from the sidebar loads its results', async () => {
    render(<JDAnalysis />);

    // Wait for history items to render
    await waitFor(() => {
      expect(screen.getByText(/Looking for a React developer with Python/)).toBeInTheDocument();
    });

    // Click history item
    const historyItem = screen.getByText(/Looking for a React developer with Python/);
    fireEvent.click(historyItem);

    // Verify the results for the selected past item are rendered
    await waitFor(() => {
      expect(screen.getByText('Update your resume.')).toBeInTheDocument();
    });
  });
});
