import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const matchmaker = functions.firestore
  .document('matchmaking_queue/{queueId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || data.status !== 'waiting') return null;

    const topic = data.topic;
    const db = admin.firestore();

    try {
      // Find other waiting candidates for the same topic
      const querySnapshot = await db.collection('matchmaking_queue')
        .where('topic', '==', topic)
        .where('status', '==', 'waiting')
        .orderBy('createdAt', 'asc')
        .get();

      const waitingUsers = querySnapshot.docs.filter(doc => doc.id !== snap.id);

      if (waitingUsers.length >= 1) {
        const peerSnap = waitingUsers[0];
        const peerData = peerSnap.data();

        const userId1 = data.userId;
        const userId2 = peerData.userId;

        // Fetch User Names
        const user1Snap = await db.collection('users').doc(userId1).get();
        const user2Snap = await db.collection('users').doc(userId2).get();
        const name1 = user1Snap.exists ? (user1Snap.data()?.displayName || 'Peer A') : 'Peer A';
        const name2 = user2Snap.exists ? (user2Snap.data()?.displayName || 'Peer B') : 'Peer B';

        // Create a unique sessionId
        const sessionId = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7);
        const inviteLink = `https://${process.env.GCLOUD_PROJECT || 'interviewmate-demo-placeholder'}.web.app/room/${sessionId}`;
        
        const topicDetail = 
          topic === 'DSA' ? 'Data Structures & Algorithms' : 
          topic === 'System Design' ? 'System Design: Architecture' : 
          topic === 'Frontend' ? 'Frontend Development' : 'HR & Behavioural';

        const sessionDoc = {
          id: sessionId,
          topic,
          topicDetail,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: 45,
          status: 'scheduled',
          hostId: userId1,
          hostName: name1,
          guestId: userId2,
          guestName: name2,
          inviteLink,
          code: '// Enter your solution here\n\nfunction solve() {\n  \n}',
          language: 'javascript',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          activeMode: 'code'
        };

        // Write batch update
        const batch = db.batch();
        batch.set(db.collection('sessions').doc(sessionId), sessionDoc);
        batch.update(db.collection('matchmaking_queue').doc(snap.id), {
          status: 'matched',
          sessionId
        });
        batch.update(db.collection('matchmaking_queue').doc(peerSnap.id), {
          status: 'matched',
          sessionId
        });

        await batch.commit();
        console.log(`Matched users ${userId1} and ${userId2} into session ${sessionId}`);

        // Deletion schedule fallback in 5 seconds
        setTimeout(async () => {
          try {
            const delBatch = db.collection('matchmaking_queue');
            await delBatch.doc(snap.id).delete();
            await delBatch.doc(peerSnap.id).delete();
            console.log(`Cleaned up matchmaking queue docs for session ${sessionId}`);
          } catch (e) {
            console.error('Error cleaning matchmaking documents:', e);
          }
        }, 5000);
      }
    } catch (err) {
      console.error('Matchmaking trigger failed:', err);
    }
    return null;
  });
