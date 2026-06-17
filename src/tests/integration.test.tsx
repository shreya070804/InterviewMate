/// <reference types="@testing-library/jest-dom" />
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../pages/Dashboard';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useAuth context to return a logged-in user
const mockUser = { uid: 'emulator-test-user-id', displayName: 'Emulator User' };
const mockProfile = { onboarded: true, displayName: 'Emulator User', hasCompletedOnboarding: false };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    updateProfile: vi.fn().mockResolvedValue({}),
  }),
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

describe('Firestore Emulator Integration Test', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  test('full session creation flow: schedules session, writes to Firestore, shows on Dashboard', async () => {
    render(<Dashboard />);

    // 1. Verify initially no scheduled sessions is shown
    await waitFor(() => {
      expect(screen.getByText(/No scheduled sessions/i)).toBeInTheDocument();
    });

    // 2. Open scheduling modal
    const scheduleBtn = screen.getByRole('button', { name: /Schedule Session/i });
    fireEvent.click(scheduleBtn);

    // 3. Fill in date and time in the future
    const dateInput = screen.getByLabelText('Date');
    const timeInput = screen.getByLabelText('Time');
    
    fireEvent.change(dateInput, { target: { value: '2030-05-15' } });
    fireEvent.change(timeInput, { target: { value: '10:00' } });

    // 4. Confirm/submit form
    const confirmBtn = screen.getByRole('button', { name: /Confirm session/i });
    fireEvent.click(confirmBtn);

    // 5. Verify document is written to the Firestore Emulator collection 'sessions'
    const db = getFirestore();
    await waitFor(async () => {
      const querySnapshot = await getDocs(collection(db, 'sessions'));
      expect(querySnapshot.size).toBe(1);
      
      const docData = querySnapshot.docs[0].data();
      expect(docData.topic).toBe('DSA');
      expect(docData.date).toBe('2030-05-15');
      expect(docData.time).toBe('10:00');
      expect(docData.hostId).toBe('emulator-test-user-id');
    });

    // 6. Verify it gets updated on the Dashboard in real-time
    await waitFor(() => {
      expect(screen.getByText('Data Structures & Algorithms')).toBeInTheDocument();
      expect(screen.queryByText(/No scheduled sessions/i)).not.toBeInTheDocument();
    });
  });
});
