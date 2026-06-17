// firestore_rules_test.js
// Tests for the Firestore security rules defined in firestore.rules.
// This script runs in the Firebase emulator using @firebase/rules-unit-testing.

const { initializeTestApp, initializeAdminApp, assertFails, assertSucceeds, loadFirestoreRules } = require('@firebase/rules-unit-testing');
const firebase = require('firebase-admin');
const fs = require('fs');

// Load the rules from the file we just created
const RULES_PATH = __dirname + '/firestore.rules';
loadFirestoreRules({ projectId: 'interviewmate-test', rules: fs.readFileSync(RULES_PATH, 'utf8') });

// Helper to get a Firestore instance for a given uid (or null for unauthenticated)
function getFirestore(uid) {
  if (uid) {
    return initializeTestApp({ projectId: 'interviewmate-test', auth: { uid } }).firestore();
  }
  return initializeTestApp({ projectId: 'interviewmate-test' }).firestore(); // unauthenticated
}

(async () => {
  // --------------------------------------------------------------------------------
  // 1. Unauthenticated request should be denied for all protected collections.
  // --------------------------------------------------------------------------------
  const unauthDb = getFirestore(null);
  // Users collection – should fail to read/write any user document
  await assertFails(unauthDb.doc('users/userA').get());
  await assertFails(unauthDb.doc('users/userA').set({ username: 'A' }));
  // Sessions collection – should fail to read a session
  await assertFails(unauthDb.doc('sessions/session1').get());
  // Matchmaking queue – should fail to read/write
  await assertFails(unauthDb.doc('matchmaking_queue/userA').get());

  // --------------------------------------------------------------------------------
  // 2. Authenticated user reading a session they are NOT a participant of.
  // --------------------------------------------------------------------------------
  // First, create a session document as admin with two participants.
  const admin = initializeAdminApp({ projectId: 'interviewmate-test' }).firestore();
  await admin.doc('sessions/sessionXYZ').set({
    participantIds: ['userBob', 'userCarol'],
    topic: 'DSA',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  const nonParticipantDb = getFirestore('userAlice'); // not in participantIds
  // Attempt to read the session – should be denied
  await assertFails(nonParticipantDb.doc('sessions/sessionXYZ').get());
  // Attempt to write (e.g., add a message subcollection) – should be denied
  await assertFails(nonParticipantDb.collection('sessions').doc('sessionXYZ').collection('messages').add({ text: 'hi' }));

  // --------------------------------------------------------------------------------
  // 3. Positive control – a participant can read/write the session.
  // --------------------------------------------------------------------------------
  const participantDb = getFirestore('userBob');
  await assertSucceeds(participantDb.doc('sessions/sessionXYZ').get());
  await assertSucceeds(participantDb.collection('sessions').doc('sessionXYZ').collection('messages').add({ text: 'hello' }));

  console.log('All rule tests passed');
  process.exit(0);
})();
