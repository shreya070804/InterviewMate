import { describe, test, expect } from 'vitest';
import { findMatch } from '../utils/matchmaker';
import type { QueueItem } from '../utils/matchmaker';

describe('matchmaker logic', () => {
  test('correctly matches two users with the same topic', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z' },
      { id: '2', userId: 'userB', topic: 'System Design', status: 'waiting', createdAt: '2026-06-17T12:01:00Z' },
    ];
    const newItem: QueueItem = {
      id: '3',
      userId: 'userC',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:02:00Z'
    };

    const match = findMatch(newItem, queue);
    expect(match).not.toBeNull();
    expect(match?.userId).toBe('userA');
  });

  test('does not match users with different topics', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'System Design', status: 'waiting', createdAt: '2026-06-17T12:00:00Z' },
    ];
    const newItem: QueueItem = {
      id: '2',
      userId: 'userB',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:01:00Z'
    };

    const match = findMatch(newItem, queue);
    expect(match).toBeNull();
  });

  test('does not match a user with themselves', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z' },
    ];
    const newItem: QueueItem = {
      id: '1',
      userId: 'userA',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:00:00Z'
    };

    const match = findMatch(newItem, queue);
    expect(match).toBeNull();
  });
});
