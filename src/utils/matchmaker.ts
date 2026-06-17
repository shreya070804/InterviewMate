export interface QueueItem {
  id: string;
  userId: string;
  topic: string;
  status: 'waiting' | 'matched';
  createdAt: string;
}

export const findMatch = (newItem: QueueItem, queue: QueueItem[]): QueueItem | null => {
  if (newItem.status !== 'waiting') return null;
  
  // Find other waiting users with the exact same topic, excluding the newItem user themselves
  const match = queue.find(
    item => 
      item.id !== newItem.id &&
      item.userId !== newItem.userId &&
      item.status === 'waiting' &&
      item.topic === newItem.topic
  );
  
  return match || null;
};
