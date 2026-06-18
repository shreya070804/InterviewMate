/// <reference types="@testing-library/jest-dom" />
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FeedbackDetails } from '../pages/FeedbackDetails';
import { getFeedback, getQuestions, getUserFeedbackList } from '../firebase';
import { generateSummaryCallable } from '../utils/apiClient';
import type { Question } from '../types';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: 'test-session-id' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useAuth context
const mockUser = { uid: 'test-user-id', displayName: 'Test User' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// Mock firebase helpers
vi.mock('../firebase', () => ({
  getFeedback: vi.fn(),
  saveFeedback: vi.fn().mockResolvedValue(true),
  getQuestions: vi.fn(),
  getUserFeedbackList: vi.fn().mockResolvedValue([]),
  checkApiUsage: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  MOCK_MODE: true
}));

// Mock apiClient callable functions
vi.mock('../utils/apiClient', () => ({
  generateFeedbackCallable: vi.fn(),
  generateSummaryCallable: vi.fn(),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => null,
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  RotateCw: () => null,
  Settings: () => null,
  Download: () => null,
  Award: () => null,
  Sparkles: () => null,
  Play: () => null
}));

// Mock Layout component
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock jsPDF and html2canvas to avoid test environment failures
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    save: vi.fn()
  }))
}));
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue(document.createElement('canvas'))
}));

describe('FeedbackDetails Next-Question Recommendation Flow', () => {
  const mockQuestions: Question[] = [
    {
      id: 'question_dsa_1',
      title: 'Reverse Linked List',
      description: 'Reverse a singly linked list.',
      difficulty: 'Easy',
      category: 'DSA'
    },
    {
      id: 'question_sys_1',
      title: 'Design YouTube',
      description: 'Design a high-volume video hosting system.',
      difficulty: 'Hard',
      category: 'System Design'
    }
  ];

  const baseFeedback = {
    sessionId: 'test-session-id',
    userId: 'test-user-id',
    reviewerId: 'alex_ai',
    topic: 'DSA Practice',
    date: '2026-06-18',
    duration: 15,
    scores: { correctness: 8, efficiency: 7, communication: 8 },
    strengths: ['Strength 1'],
    improvements: ['Improvement 1'],
    summary: 'Summary text',
    createdAt: '2026-06-18T10:00:00Z',
    sessionSummary: {
      what_was_attempted: 'Attempted Two Sum',
      what_went_well: 'Sliding window',
      biggest_gap: 'Null check',
      top_study_topic: 'DSA',
      estimated_readiness: 75
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getQuestions).mockResolvedValue(mockQuestions);
  });

  test('loads feedback, computes weakest category, calls API and displays recommended question', async () => {
    vi.mocked(getFeedback).mockResolvedValue({
      ...baseFeedback
    } as any);

    vi.mocked(getUserFeedbackList).mockResolvedValue([
      {
        topic: 'DSA Practice',
        scores: { correctness: 5, efficiency: 4, communication: 6 }
      } as any,
      {
        topic: 'System Design Mock',
        scores: { correctness: 9, efficiency: 8, communication: 9 }
      } as any
    ]);

    vi.mocked(generateSummaryCallable).mockResolvedValue({
      data: {
        content: [{
          text: JSON.stringify({
            recommended_question_id: 'question_dsa_1',
            recommended_category: null,
            reason: 'You scored low in DSA correctness, practice this to reinforce lists.'
          })
        }]
      }
    } as any);

    render(<FeedbackDetails />);

    // Check that header renders
    await waitFor(() => {
      expect(screen.getByText('What to practice next')).toBeInTheDocument();
    });

    // Check recommended question title and info
    expect(screen.getByText('Reverse Linked List')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getAllByText('DSA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/You scored low in DSA correctness, practice this to reinforce lists/)).toBeInTheDocument();

    // Check practice now button and click behavior
    const practiceBtn = screen.getByRole('button', { name: /Practice this now/i });
    fireEvent.click(practiceBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/solo', {
      state: {
        prefillQuestion: mockQuestions[0]
      }
    });
  });

  test('falls back to category recommendation when question_id is null', async () => {
    vi.mocked(getFeedback).mockResolvedValue({
      ...baseFeedback
    } as any);

    vi.mocked(getUserFeedbackList).mockResolvedValue([]);

    vi.mocked(generateSummaryCallable).mockResolvedValue({
      data: {
        content: [{
          text: JSON.stringify({
            recommended_question_id: null,
            recommended_category: 'System Design',
            reason: 'Focus on scaling distributed designs next.'
          })
        }]
      }
    } as any);

    render(<FeedbackDetails />);

    await waitFor(() => {
      expect(screen.getByText('What to practice next')).toBeInTheDocument();
    });

    expect(screen.getByText('Domain: System Design')).toBeInTheDocument();
    expect(screen.getByText(/Focus on scaling distributed designs next/)).toBeInTheDocument();

    const practiceBtn = screen.getByRole('button', { name: /Practice this now/i });
    fireEvent.click(practiceBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/solo', {
      state: {
        prefillTopic: 'System Design'
      }
    });
  });

  test('displays already existing recommendation from database without calling API', async () => {
    vi.mocked(getFeedback).mockResolvedValue({
      ...baseFeedback,
      nextRecommendation: {
        recommended_question_id: 'question_sys_1',
        recommended_category: null,
        reason: 'Saved database reason.'
      }
    } as any);

    render(<FeedbackDetails />);

    await waitFor(() => {
      expect(screen.getByText('What to practice next')).toBeInTheDocument();
    });

    expect(screen.getByText('Design YouTube')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();
    expect(screen.getByText(/Saved database reason/)).toBeInTheDocument();

    expect(generateSummaryCallable).not.toHaveBeenCalled();
  });
});
