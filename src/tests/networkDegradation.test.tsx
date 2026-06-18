/// <reference types="@testing-library/jest-dom" />
import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import * as Sentry from '@sentry/react';

// Stub the Agora app id so that setupAgora path is taken in testing
vi.stubEnv('VITE_AGORA_APP_ID', 'test-app-id');

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ sessionId: 'test-session-id' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock useAuth context
const mockUser = { uid: 'test-user-id', displayName: 'Test User' };
const mockProfile = { onboarded: true, displayName: 'Test User' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
  }),
}));

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// Define tracks inside the mock factory and put spies on globalThis so we can test them
vi.mock('agora-rtc-sdk-ng', () => {
  const mockVideoTrack = {
    enabled: true,
    setEnabled: vi.fn().mockImplementation(function(val) {
      mockVideoTrack.enabled = val;
      return Promise.resolve();
    }),
    play: vi.fn(),
    stop: vi.fn(),
    close: vi.fn(),
    trackMediaType: 'video'
  };
  const mockAudioTrack = {
    enabled: true,
    setEnabled: vi.fn().mockImplementation(function(val) {
      mockAudioTrack.enabled = val;
      return Promise.resolve();
    }),
    stop: vi.fn(),
    close: vi.fn(),
    trackMediaType: 'audio'
  };
  (globalThis as any).mockVideoTrackSpy = mockVideoTrack;
  (globalThis as any).mockAudioTrackSpy = mockAudioTrack;
  (globalThis as any).agoraListeners = {};

  const mockClient = {
    join: vi.fn().mockResolvedValue({}),
    publish: vi.fn().mockResolvedValue({}),
    leave: vi.fn().mockResolvedValue({}),
    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      (globalThis as any).agoraListeners[event] = callback;
    }),
  };
  return {
    default: {
      createClient: () => mockClient,
      createMicrophoneAndCameraTracks: vi.fn().mockResolvedValue([mockAudioTrack, mockVideoTrack]),
    },
  };
});

// Mock firebase database functions
vi.mock('../firebase', () => ({
  subscribeToSession: vi.fn().mockImplementation((_sessionId, callback) => {
    callback({
      id: 'test-session-id',
      topic: 'DSA',
      topicDetail: 'Data Structures & Algorithms',
      duration: 45,
      hostId: 'test-user-id',
      hostName: 'Test Host',
      guestId: 'guest-user-id',
      guestName: 'Test Guest',
      status: 'active',
      code: '// initial code',
      language: 'javascript',
      activeMode: 'code',
      createdAt: new Date().toISOString(),
    });
    return () => {};
  }),
  updateSession: vi.fn().mockResolvedValue({}),
  getQuestions: vi.fn().mockResolvedValue([]),
  saveFeedback: vi.fn().mockResolvedValue({}),
  saveQuestion: vi.fn().mockResolvedValue({}),
  getUserProfile: vi.fn().mockResolvedValue({ onboarded: true, displayName: 'Test User' }),
  MOCK_MODE: true,
  sendChatMessage: vi.fn().mockResolvedValue({}),
  subscribeToChatMessages: vi.fn().mockImplementation((_sessionId, callback) => {
    callback([]);
    return () => {};
  }),
  checkApiUsage: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  runCode: vi.fn(),
}));

// Mock layout components
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="mock-editor">Monaco Editor</div>,
}));

describe('Agora Network Degradation and Graceful Fallback in InterviewRoom', () => {
  let InterviewRoom: React.ComponentType;

  beforeAll(async () => {
    vi.stubEnv('VITE_AGORA_APP_ID', 'test-app-id');
    const mod = await import('../pages/InterviewRoom');
    InterviewRoom = mod.InterviewRoom;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).agoraListeners = {};
    (globalThis as any).mockVideoTrackSpy.enabled = true;
    (globalThis as any).mockAudioTrackSpy.enabled = true;
  });

  test('subscribes to network-quality and connection-state-change and shows poor connection warning', async () => {
    render(<InterviewRoom />);

    await waitFor(() => {
      expect((globalThis as any).agoraListeners['connection-state-change']).toBeDefined();
    });

    // First, simulate successful join (CONNECTED) so that lost connection banner is hidden
    act(() => {
      (globalThis as any).agoraListeners['connection-state-change']('CONNECTED', 'DISCONNECTED', 'JOIN_SUCCESS');
    });

    // Wait for the Connection Lost banner to disappear
    await waitFor(() => {
      expect(screen.queryByText(/Connection lost — trying to reconnect/)).not.toBeInTheDocument();
    });

    // Trigger network quality degradation event
    act(() => {
      (globalThis as any).agoraListeners['network-quality']({
        uplinkNetworkQuality: 4,
        downlinkNetworkQuality: 4,
      });
    });

    // Check that connection degraded banner renders
    expect(screen.getByText(/Your connection is unstable — switched to audio-only/)).toBeInTheDocument();

    // Verify Sentry reports the degradation
    await waitFor(() => {
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Agora Network Quality Degraded: uplink=4, downlink=4'),
        expect.any(Object)
      );
    });

    // Verify local video track was disabled
    await waitFor(() => {
      expect((globalThis as any).mockVideoTrackSpy.setEnabled).toHaveBeenCalledWith(false);
    });

    // Click "Retry Video" to re-enable video track
    const retryBtn = screen.getByRole('button', { name: /Retry Video/i });
    act(() => {
      fireEvent.click(retryBtn);
    });

    // Verify the banner is gone
    expect(screen.queryByText(/Your connection is unstable — switched to audio-only/)).not.toBeInTheDocument();
    
    // Verify local video track is re-enabled
    expect((globalThis as any).mockVideoTrackSpy.setEnabled).toHaveBeenCalledWith(true);
  });

  test('shows connection lost banner on disconnection state change', async () => {
    render(<InterviewRoom />);

    await waitFor(() => {
      expect((globalThis as any).agoraListeners['connection-state-change']).toBeDefined();
    });

    // Trigger full disconnect
    act(() => {
      (globalThis as any).agoraListeners['connection-state-change']('DISCONNECTED', 'CONNECTED', 'UID_DISCONNECT');
    });

    // Check that reconnecting banner is visible
    expect(screen.getByText(/Connection lost — trying to reconnect/)).toBeInTheDocument();

    // Verify Sentry reports the disconnect event
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('Agora connection state: DISCONNECTED'),
      expect.any(Object)
    );
  });

  test('shows connection lost banner when network quality drops to 6', async () => {
    render(<InterviewRoom />);

    await waitFor(() => {
      expect((globalThis as any).agoraListeners['network-quality']).toBeDefined();
    });

    // Trigger quality 6 (completely down)
    act(() => {
      (globalThis as any).agoraListeners['network-quality']({
        uplinkNetworkQuality: 6,
        downlinkNetworkQuality: 6,
      });
    });

    // Check that reconnecting banner is visible
    expect(screen.getByText(/Connection lost — trying to reconnect/)).toBeInTheDocument();
  });
});
