(globalThis as any).__MOCK_MODE__ = true;
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { runCode } from '../firebase';

describe('runCode client wrapper and rate limits', () => {
  beforeEach(() => {
    // Clear local storage to reset rate limits
    localStorage.clear();
    localStorage.setItem('im_judge0_key', 'test_key');
    vi.restoreAllMocks();
  });

  test('rejects code submissions longer than 5000 characters', async () => {
    const hugeCode = 'a'.repeat(5001);
    await expect(runCode('test_user_id', hugeCode, 'javascript')).rejects.toThrow(
      'Code submission exceeds the 5000 character limit.'
    );
  });

  test('allows code submissions of exactly 5000 characters', async () => {
    // Mock fetch to avoid hitting RapidAPI or throwing when it is not configured
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stdout: btoa('success'),
        status: { id: 3, description: 'Accepted' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const exactCode = 'a'.repeat(5000);
    const result = await runCode('test_user_id', exactCode, 'javascript');
    expect(result).toBeDefined();
  });

  test('enforces rate limit of 30 code executions per hour', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stdout: btoa('success'),
        status: { id: 3, description: 'Accepted' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    // Perform 30 successful executions
    for (let i = 0; i < 30; i++) {
      const result = await runCode('test_user_id', 'console.log("hello");', 'javascript');
      expect(result).toBeDefined();
    }

    // The 31st execution should throw
    await expect(runCode('test_user_id', 'console.log("hello");', 'javascript')).rejects.toThrow(
      'Execution limit reached, try again in a bit'
    );
  });

  test('resets execution limit when the hour changes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stdout: btoa('success'),
        status: { id: 3, description: 'Accepted' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    // Initial 30 executions in current hour
    for (let i = 0; i < 30; i++) {
      await runCode('test_user_id', 'console.log("hello");', 'javascript');
    }

    // 31st throws
    await expect(runCode('test_user_id', 'console.log("hello");', 'javascript')).rejects.toThrow(
      'Execution limit reached, try again in a bit'
    );

    // Mock time moving forward by 1 hour
    const now = new Date();
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000 + 1000); // 1 hour + 1 second later
    vi.useFakeTimers();
    vi.setSystemTime(futureTime);

    // Now it should allow execution again
    const result = await runCode('test_user_id', 'console.log("hello");', 'javascript');
    expect(result).toBeDefined();

    vi.useRealTimers();
  });
});
