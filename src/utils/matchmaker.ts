export interface QueueItem {
  id: string;
  userId: string;
  topic: string;
  status: 'waiting' | 'matched';
  createdAt: string;
  experienceLevel?: 'Student' | '0-1 yrs' | '1-3 yrs' | '3+ yrs';
}

export const findMatch = (newItem: QueueItem, queue: QueueItem[]): QueueItem | null => {
  if (newItem.status !== 'waiting') return null;
  
  // Find other waiting users with the exact same topic, excluding the newItem user themselves
  const waitingPeers = queue.filter(
    item => 
      item.id !== newItem.id &&
      item.userId !== newItem.userId &&
      item.status === 'waiting' &&
      item.topic === newItem.topic
  );
  
  if (waitingPeers.length === 0) return null;

  const myExp = newItem.experienceLevel || 'Student';

  // 1. Try same experience level first
  let match = waitingPeers.find(item => (item.experienceLevel || 'Student') === myExp);

  // 2. Fall back to anyone who has waited > 60 seconds (comparing relative to newItem's createdAt)
  if (!match) {
    const newTime = new Date(newItem.createdAt).getTime();
    match = waitingPeers.find(item => {
      const peerTime = new Date(item.createdAt).getTime();
      return (newTime - peerTime) >= 60000;
    });
  }

  return match || null;
};
