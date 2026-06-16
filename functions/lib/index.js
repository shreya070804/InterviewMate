"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSessionDelete = exports.onSessionUpdate = exports.sendSessionReminders = exports.calculateWeeklyLeaderboard = exports.parseResume = exports.matchmaker = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const resend_1 = require("resend");
admin.initializeApp();
exports.matchmaker = functions.firestore
    .document('matchmaking_queue/{queueId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || data.status !== 'waiting')
        return null;
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
            const topicDetail = topic === 'DSA' ? 'Data Structures & Algorithms' :
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
                }
                catch (e) {
                    console.error('Error cleaning matchmaking documents:', e);
                }
            }, 5000);
        }
    }
    catch (err) {
        console.error('Matchmaking trigger failed:', err);
    }
    return null;
});
const pdf = require('pdf-parse');
exports.parseResume = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const pdfBase64 = data.pdfBase64;
    if (!pdfBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing pdfBase64 argument.');
    }
    try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const parsedData = await pdf(pdfBuffer);
        const text = parsedData.text || '';
        const uid = context.auth.uid;
        await admin.firestore().collection('users').doc(uid).set({
            resumeText: text
        }, { merge: true });
        return { success: true, text };
    }
    catch (error) {
        console.error('Error parsing PDF:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to parse PDF.');
    }
});
exports.calculateWeeklyLeaderboard = functions.pubsub
    .schedule('0 0 * * 1') // Every Monday at midnight
    .onRun(async (context) => {
    const db = admin.firestore();
    try {
        // Get all opted-in users
        const optInSnapshot = await db.collection('leaderboard_opt_in')
            .where('optedIn', '==', true)
            .get();
        const userScores = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        for (const optInDoc of optInSnapshot.docs) {
            const optInData = optInDoc.data();
            const userId = optInData.userId;
            const displayName = optInData.displayName || 'Anonymous';
            // Query feedback sessions
            const feedbackSnapshot = await db.collection('feedback')
                .where('userId', '==', userId)
                .get();
            let totalScore = 0;
            let count = 0;
            for (const fbDoc of feedbackSnapshot.docs) {
                const fbData = fbDoc.data();
                const createdAt = fbData.createdAt;
                // Check if within 7 days
                let matchesDate = false;
                if (createdAt) {
                    const dateMillis = typeof createdAt.toDate === 'function'
                        ? createdAt.toDate().getTime()
                        : new Date(createdAt).getTime();
                    if (dateMillis >= sevenDaysAgo.getTime()) {
                        matchesDate = true;
                    }
                }
                if (matchesDate && fbData.scores) {
                    const avgSessionScore = (fbData.scores.correctness + fbData.scores.efficiency + fbData.scores.communication) / 3;
                    totalScore += avgSessionScore;
                    count++;
                }
            }
            userScores.push({
                userId,
                displayName,
                avgScore: count > 0 ? parseFloat((totalScore / count).toFixed(2)) : 0,
                sessionsCompleted: count
            });
        }
        // Sort by avgScore desc, then by sessionsCompleted desc
        userScores.sort((a, b) => b.avgScore - a.avgScore || b.sessionsCompleted - a.sessionsCompleted);
        // Write ranks to weekly_leaderboard
        const batch = db.batch();
        const leaderboardCol = db.collection('weekly_leaderboard');
        // Delete existing
        const currentLeaderboard = await leaderboardCol.get();
        currentLeaderboard.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        userScores.forEach((user, index) => {
            const rank = index + 1;
            const ref = leaderboardCol.doc(user.userId);
            batch.set(ref, {
                rank,
                userId: user.userId,
                displayName: user.displayName,
                avgScore: user.avgScore,
                sessionsCompleted: user.sessionsCompleted,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        console.log(`Successfully calculated weekly leaderboard for ${userScores.length} users.`);
    }
    catch (err) {
        console.error('Error calculating leaderboard:', err);
    }
    return null;
});
// Helper to send emails
const getResendClient = () => {
    const apiKey = functions.config().resend?.key || process.env.RESEND_API_KEY || '';
    if (!apiKey || apiKey === 're_123456789') {
        console.warn("Resend API Key is missing or default. Falling back to Log Mode.");
        return null;
    }
    return new resend_1.Resend(apiKey);
};
exports.sendSessionReminders = functions.pubsub
    .schedule('*/5 * * * *') // Every 5 minutes
    .onRun(async (context) => {
    const db = admin.firestore();
    const resend = getResendClient();
    try {
        const now = new Date();
        // Fetch scheduled sessions where reminderSent != true
        const snapshot = await db.collection('sessions')
            .where('status', '==', 'scheduled')
            .where('reminderSent', '!=', true)
            .get();
        console.log(`Checking reminders for ${snapshot.size} scheduled sessions.`);
        for (const sessionDoc of snapshot.docs) {
            const session = sessionDoc.data();
            const { date, time, hostId, guestId, topicDetail, id, inviteLink } = session;
            if (!date || !time)
                continue;
            // Parse session date & time.
            // Format: date = YYYY-MM-DD, time = HH:MM
            // We will assume the local timezone is IST (UTC+05:30)
            let sessionTime = new Date(`${date}T${time}:00+05:30`);
            if (isNaN(sessionTime.getTime())) {
                sessionTime = new Date(`${date}T${time}:00`);
            }
            const diffMinutes = (sessionTime.getTime() - now.getTime()) / (60 * 1000);
            console.log(`Session ${id}: Scheduled at ${sessionTime.toISOString()}. Difference: ${diffMinutes.toFixed(1)} minutes.`);
            // Trigger if session starts in the next 15 to 20 minutes
            if (diffMinutes >= 15 && diffMinutes <= 20) {
                // Fetch Host and Guest Profiles
                const hostSnap = await db.collection('users').doc(hostId).get();
                const guestSnap = guestId ? await db.collection('users').doc(guestId).get() : null;
                const hostEmail = hostSnap.exists ? hostSnap.data()?.email : null;
                const guestEmail = guestSnap && guestSnap.exists ? guestSnap.data()?.email : null;
                const hostName = hostSnap.exists ? (hostSnap.data()?.displayName || 'Interviewer') : 'Interviewer';
                const guestName = guestSnap && guestSnap.exists ? (guestSnap.data()?.displayName || 'Candidate') : 'Candidate';
                console.log(`Sending reminder for Session ${id} to Host (${hostEmail}) and Guest (${guestEmail})`);
                // HTML Email Body Helper
                const buildEmailHtml = (recipientName, partnerName) => {
                    return `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #006865; padding-bottom: 12px;">
                  <h2 style="color: #006865; margin: 0; font-size: 26px; font-weight: 800; tracking-wide: true;">InterviewMate</h2>
                </div>
                <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
                  <h3 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 700;">Your mock interview starts in 15 minutes</h3>
                  <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                    Hi <strong>${recipientName}</strong>,
                  </p>
                  <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                    This is a reminder that your scheduled mock interview session on <strong>${topicDetail || 'Technical Assessment'}</strong> is starting soon.
                  </p>
                  <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
                    Your practice partner for this session is <strong>${partnerName}</strong>.
                  </p>
                  <div style="margin: 28px 0; text-align: center;">
                    <a href="${inviteLink}" style="background-color: #006865; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 104, 101, 0.2);">
                      Join Room Now
                    </a>
                  </div>
                </div>
                <div style="text-align: center; color: #64748b; font-size: 11px;">
                  This is an automated reminder from InterviewMate. If you have any issues, please contact support.
                  <br/>
                  &copy; 2026 InterviewMate. All rights reserved.
                </div>
              </div>
            `;
                };
                // Send to Host
                if (hostEmail) {
                    const hostHtml = buildEmailHtml(hostName, guestName);
                    if (resend) {
                        await resend.emails.send({
                            from: 'InterviewMate Reminders <onboarding@resend.dev>',
                            to: hostEmail,
                            subject: 'Your mock interview starts in 15 minutes',
                            html: hostHtml
                        });
                    }
                    else {
                        console.log(`[MOCK EMAIL to Host: ${hostEmail}] Subject: Your mock interview starts in 15 minutes\\nBody: ${hostHtml}`);
                    }
                }
                // Send to Guest
                if (guestEmail) {
                    const guestHtml = buildEmailHtml(guestName, hostName);
                    if (resend) {
                        await resend.emails.send({
                            from: 'InterviewMate Reminders <onboarding@resend.dev>',
                            to: guestEmail,
                            subject: 'Your mock interview starts in 15 minutes',
                            html: guestHtml
                        });
                    }
                    else {
                        console.log(`[MOCK EMAIL to Guest: ${guestEmail}] Subject: Your mock interview starts in 15 minutes\\nBody: ${guestHtml}`);
                    }
                }
                // Mark reminderSent: true on the session document after sending
                await db.collection('sessions').doc(sessionDoc.id).update({
                    reminderSent: true
                });
            }
        }
    }
    catch (err) {
        console.error('sendSessionReminders trigger failed:', err);
    }
    return null;
});
exports.onSessionUpdate = functions.firestore
    .document('sessions/{sessionId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return null;
    // Check if date or time or duration changed
    if (before.date !== after.date || before.time !== after.time || before.duration !== after.duration) {
        const db = admin.firestore();
        const resend = getResendClient();
        const { hostId, guestId, topicDetail } = after;
        // Fetch Host and Guest Profiles
        const hostSnap = await db.collection('users').doc(hostId).get();
        const guestSnap = guestId ? await db.collection('users').doc(guestId).get() : null;
        const hostEmail = hostSnap.exists ? hostSnap.data()?.email : null;
        const guestEmail = guestSnap && guestSnap.exists ? guestSnap.data()?.email : null;
        const hostName = hostSnap.exists ? (hostSnap.data()?.displayName || 'Interviewer') : 'Interviewer';
        const guestName = guestSnap && guestSnap.exists ? (guestSnap.data()?.displayName || 'Candidate') : 'Candidate';
        const buildRescheduleHtml = (recipientName) => {
            return `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #006865; padding-bottom: 12px;">
              <h2 style="color: #006865; margin: 0; font-size: 26px; font-weight: 800;">InterviewMate</h2>
            </div>
            <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
              <h3 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 700;">Interview Rescheduled</h3>
              <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
                Your scheduled mock interview session on <strong>${topicDetail || 'Technical Assessment'}</strong> has been rescheduled.
              </p>
              <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
                <strong>Previous Time:</strong> ${before.date} at ${before.time} (${before.duration} mins)
              </p>
              <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
                <strong>New Time:</strong> ${after.date} at ${after.time} (${after.duration} mins)
              </p>
              <div style="margin: 28px 0; text-align: center;">
                <a href="${after.inviteLink}" style="background-color: #006865; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 104, 101, 0.2);">
                  View Updated Session
                </a>
              </div>
            </div>
            <div style="text-align: center; color: #64748b; font-size: 11px;">
              &copy; 2026 InterviewMate. All rights reserved.
            </div>
          </div>
        `;
        };
        const subject = `Rescheduled: Mock interview on ${topicDetail || 'Technical Assessment'}`;
        if (hostEmail) {
            const hostHtml = buildRescheduleHtml(hostName);
            if (resend) {
                await resend.emails.send({
                    from: 'InterviewMate <onboarding@resend.dev>',
                    to: hostEmail,
                    subject,
                    html: hostHtml
                });
            }
            else {
                console.log(`[MOCK EMAIL to Host: ${hostEmail}] Subject: ${subject}\nBody: ${hostHtml}`);
            }
        }
        if (guestEmail) {
            const guestHtml = buildRescheduleHtml(guestName);
            if (resend) {
                await resend.emails.send({
                    from: 'InterviewMate <onboarding@resend.dev>',
                    to: guestEmail,
                    subject,
                    html: guestHtml
                });
            }
            else {
                console.log(`[MOCK EMAIL to Guest: ${guestEmail}] Subject: ${subject}\nBody: ${guestHtml}`);
            }
        }
    }
    return null;
});
exports.onSessionDelete = functions.firestore
    .document('sessions/{sessionId}')
    .onDelete(async (snap, context) => {
    const data = snap.data();
    if (!data)
        return null;
    const db = admin.firestore();
    const resend = getResendClient();
    const { hostId, guestId, topicDetail, date, time } = data;
    // Fetch Host and Guest Profiles
    const hostSnap = await db.collection('users').doc(hostId).get();
    const guestSnap = guestId ? await db.collection('users').doc(guestId).get() : null;
    const hostEmail = hostSnap.exists ? hostSnap.data()?.email : null;
    const guestEmail = guestSnap && guestSnap.exists ? guestSnap.data()?.email : null;
    const hostName = hostSnap.exists ? (hostSnap.data()?.displayName || 'Interviewer') : 'Interviewer';
    const guestName = guestSnap && guestSnap.exists ? (guestSnap.data()?.displayName || 'Candidate') : 'Candidate';
    const buildCancellationHtml = (recipientName, partnerName) => {
        return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #006865; padding-bottom: 12px;">
            <h2 style="color: #006865; margin: 0; font-size: 26px; font-weight: 800;">InterviewMate</h2>
          </div>
          <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="color: #ef4444; margin-top: 0; font-size: 18px; font-weight: 700;">Session Cancelled</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
              Hi <strong>${recipientName}</strong>,
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 16px;">
              The scheduled mock interview session on <strong>${topicDetail || 'Technical Assessment'}</strong> at <strong>${date} at ${time}</strong> has been cancelled.
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
              You can log back into InterviewMate to find and schedule a new session with another peer.
            </p>
          </div>
          <div style="text-align: center; color: #64748b; font-size: 11px;">
            &copy; 2026 InterviewMate. All rights reserved.
          </div>
        </div>
      `;
    };
    const subject = `Cancelled: Mock interview on ${topicDetail || 'Technical Assessment'}`;
    if (hostEmail) {
        const hostHtml = buildCancellationHtml(hostName, guestName);
        if (resend) {
            await resend.emails.send({
                from: 'InterviewMate <onboarding@resend.dev>',
                to: hostEmail,
                subject,
                html: hostHtml
            });
        }
        else {
            console.log(`[MOCK EMAIL to Host: ${hostEmail}] Subject: ${subject}\nBody: ${hostHtml}`);
        }
    }
    if (guestEmail) {
        const guestHtml = buildCancellationHtml(guestName, hostName);
        if (resend) {
            await resend.emails.send({
                from: 'InterviewMate <onboarding@resend.dev>',
                to: guestEmail,
                subject,
                html: guestHtml
            });
        }
        else {
            console.log(`[MOCK EMAIL to Guest: ${guestEmail}] Subject: ${subject}\nBody: ${guestHtml}`);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map