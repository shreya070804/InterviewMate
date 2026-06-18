import { describe, test, expect } from 'vitest';
import { findMatch } from '../utils/matchmaker';
import type { QueueItem } from '../utils/matchmaker';

describe('matchmaker logic', () => {
  test('correctly matches two users with the same topic', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z', experienceLevel: 'Student' },
      { id: '2', userId: 'userB', topic: 'System Design', status: 'waiting', createdAt: '2026-06-17T12:01:00Z', experienceLevel: '1-3 yrs' },
    ];
    const newItem: QueueItem = {
      id: '3',
      userId: 'userC',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:02:00Z',
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).not.toBeNull();
    expect(match?.userId).toBe('userA');
  });

  test('does not match users with different topics', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'System Design', status: 'waiting', createdAt: '2026-06-17T12:00:00Z', experienceLevel: 'Student' },
    ];
    const newItem: QueueItem = {
      id: '2',
      userId: 'userB',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:01:00Z',
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).toBeNull();
  });

  test('does not match a user with themselves', () => {
    const queue: QueueItem[] = [
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z', experienceLevel: 'Student' },
    ];
    const newItem: QueueItem = {
      id: '1',
      userId: 'userA',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:00:00Z',
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).toBeNull();
  });

  test('prefers matching users with the same experience level', () => {
    const queue: QueueItem[] = [
      // userA has been waiting longer but has a different level (1-3 yrs)
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z', experienceLevel: '1-3 yrs' },
      // userB joined later but has the same level (Student)
      { id: '2', userId: 'userB', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:30Z', experienceLevel: 'Student' },
    ];
    const newItem: QueueItem = {
      id: '3',
      userId: 'userC',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:00:45Z',
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).not.toBeNull();
    expect(match?.userId).toBe('userB'); // Same level preferred even though userA has been waiting longer
  });

  test('falls back to any available match after 60 seconds of waiting', () => {
    const queue: QueueItem[] = [
      // userA has been waiting for more than 60 seconds (relative to newItem's createdAt)
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:00Z', experienceLevel: '1-3 yrs' },
    ];
    const newItem: QueueItem = {
      id: '2',
      userId: 'userB',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:01:05Z', // 65 seconds later
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).not.toBeNull();
    expect(match?.userId).toBe('userA'); // Falls back since userA has waited > 60s
  });

  test('does not fall back to different experience level if peer has waited less than 60 seconds', () => {
    const queue: QueueItem[] = [
      // userA has only been waiting for 30 seconds
      { id: '1', userId: 'userA', topic: 'DSA', status: 'waiting', createdAt: '2026-06-17T12:00:30Z', experienceLevel: '1-3 yrs' },
    ];
    const newItem: QueueItem = {
      id: '2',
      userId: 'userB',
      topic: 'DSA',
      status: 'waiting',
      createdAt: '2026-06-17T12:01:00Z', // Exactly 30 seconds later
      experienceLevel: 'Student'
    };

    const match = findMatch(newItem, queue);
    expect(match).toBeNull(); // No match because same level not found and peer waited < 60s
  });
});

