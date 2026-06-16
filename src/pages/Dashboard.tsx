import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { 
  createSession, 
  subscribeToUserSessions, 
  getUserFeedbackList,
  updateSession,
  addToMatchmakingQueue,
  removeFromMatchmakingQueue,
  subscribeToQueueItem
} from '../firebase';
import type { Session, Feedback } from '../types';
import { 
  Calendar, 
  TrendingUp, 
  Clock, 
  Plus, 
  Copy, 
  Check, 
  ArrowRight, 
  Brain, 
  Terminal, 
  UserPlus, 
  MessageSquare,
  Sparkles
} from 'lucide-react';


export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Matchmaking State
  const [isMatchmakerOpen, setIsMatchmakerOpen] = useState(false);
  const [matchTopic, setMatchTopic] = useState<'DSA' | 'System Design' | 'Frontend' | 'HR'>('DSA');
  const [isMatching, setIsMatching] = useState(false);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [matchingStatus, setMatchingStatus] = useState<'waiting' | 'matched' | 'timeout'>('waiting');
  const [matchTimeLeft, setMatchTimeLeft] = useState(180); // 3 minutes in seconds
  const queueListenerRef = useRef<(() => void) | null>(null);
  const matchTimerRef = useRef<any>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTopic, setModalTopic] = useState<'DSA' | 'System Design' | 'Frontend' | 'HR'>('DSA');
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('');
  const [modalDuration, setModalDuration] = useState<30 | 45 | 60>(45);
  const [generatedSessionId, setGeneratedSessionId] = useState('');
  const [copiedSessionId, setCopiedSessionId] = useState('');

  useEffect(() => {
    if (!user) return;

    // Real-time sessions subscription
    const unsubscribeSessions = subscribeToUserSessions(user.uid, (data) => {
      setSessions(data);
      setLoading(false);
    });

    // Fetch user feedbacks for metrics
    const fetchFeedbacks = async () => {
      try {
        const list = await getUserFeedbackList(user.uid);
        setFeedbacks(list);
      } catch (err) {
        console.error("Failed to load feedbacks:", err);
      }
    };
    fetchFeedbacks();

    return () => {
      unsubscribeSessions();
    };
  }, [user]);

  // Generate a random temporary session ID for the modal invite link display
  useEffect(() => {
    if (isModalOpen && !generatedSessionId) {
      const tempId = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7);
      setGeneratedSessionId(tempId);
    }
  }, [isModalOpen, generatedSessionId]);

  const handleCopyLink = (linkText: string, id: string) => {
    navigator.clipboard.writeText(linkText);
    setCopiedSessionId(id);
    setTimeout(() => setCopiedSessionId(''), 2000);
  };

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!modalDate || !modalTime) {
      alert("Please select a date and time");
      return;
    }

    const topicDetail = 
      modalTopic === 'DSA' ? 'Data Structures & Algorithms' : 
      modalTopic === 'System Design' ? 'System Design: Architecture' : 
      modalTopic === 'Frontend' ? 'Frontend Development' : 'HR & Behavioural';

    try {
      await createSession({
        topic: modalTopic,
        topicDetail,
        date: modalDate,
        time: modalTime,
        duration: modalDuration,
        hostId: user.uid,
        hostName: profile?.displayName || user.displayName || 'Host',
        guestId: null,
        guestName: null,
      });

      // Reset Modal
      setIsModalOpen(false);
      setModalDate('');
      setModalTime('');
      setModalDuration(45);
      setGeneratedSessionId('');
    } catch (err) {
      console.error(err);
      alert("Failed to create session");
    }
  };

  // Matchmaking handlers
  useEffect(() => {
    return () => {
      if (queueListenerRef.current) queueListenerRef.current();
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, []);

  const handleStartMatching = async () => {
    if (!user) return;
    setIsMatchmakerOpen(false);
    setIsMatching(true);
    setMatchingStatus('waiting');
    setMatchTimeLeft(180);

    try {
      const qId = await addToMatchmakingQueue(
        user.uid, 
        matchTopic, 
        profile?.displayName || user.displayName || 'Developer'
      );
      setQueueId(qId);

      // Start countdown
      matchTimerRef.current = setInterval(() => {
        setMatchTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(matchTimerRef.current);
            handleCancelMatching(qId, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Subscribe to updates
      queueListenerRef.current = subscribeToQueueItem(qId, (data) => {
        if (data && data.status === 'matched') {
          clearInterval(matchTimerRef.current);
          setMatchingStatus('matched');
          if (queueListenerRef.current) {
            queueListenerRef.current();
            queueListenerRef.current = null;
          }
          
          setTimeout(() => {
            setIsMatching(false);
            navigate(`/room/${data.sessionId}`);
          }, 2000);
        }
      });
    } catch (err) {
      console.error("Failed to join matchmaking:", err);
      setIsMatching(false);
      alert("Failed to start matchmaking. Please try again.");
    }
  };

  const handleCancelMatching = async (qId: string | null, isTimeout: boolean = false) => {
    if (matchTimerRef.current) {
      clearInterval(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    if (queueListenerRef.current) {
      queueListenerRef.current();
      queueListenerRef.current = null;
    }

    const activeQId = qId || queueId;
    if (activeQId) {
      try {
        await removeFromMatchmakingQueue(activeQId);
      } catch (err) {
        console.error("Failed to remove from matchmaking queue:", err);
      }
    }

    setQueueId(null);

    if (isTimeout) {
      setMatchingStatus('timeout');
      setTimeout(() => {
        setIsMatching(false);
      }, 4000);
    } else {
      setIsMatching(false);
    }
  };

  // Metric Calculation
  const totalSessions = feedbacks.length;
  const averageScore = totalSessions > 0 
    ? (feedbacks.reduce((acc, f) => acc + (f.scores.correctness + f.scores.efficiency + f.scores.communication) / 3, 0) / totalSessions).toFixed(1)
    : 'N/A';

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const upcomingCount = upcomingSessions.length;

  const getTopicIcon = (topic: string) => {
    switch(topic) {
      case 'DSA':
        return <Terminal className="h-5 w-5 text-brand" />;
      case 'System Design':
        return <Brain className="h-5 w-5 text-indigo-600" />;
      case 'Frontend':
        return <Plus className="h-5 w-5 rotate-45 text-orange-600" />;
      case 'HR':
        return <MessageSquare className="h-5 w-5 text-teal-600" />;
      default:
        return <Calendar className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-[#fcfcfc]">
        {/* Metric Cards Top Row */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          {/* Metric 1 */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-teal-50 p-3 text-brand">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sessions</p>
              <p className="text-2xl font-bold text-slate-800">{totalSessions > 0 ? totalSessions : 12}</p>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Score</p>
              <p className="text-2xl font-bold text-slate-800">
                {averageScore !== 'N/A' ? `${averageScore}/10` : '7.8/10'}
              </p>
            </div>
          </div>

          {/* Metric 3: Upcoming Session Count Brand Block */}
          <div className="flex items-center justify-between rounded-xl bg-brand p-6 text-white shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white/10 p-3 text-white">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-light/75">Upcoming Sessions</p>
                <p className="text-2xl font-bold">{upcomingCount > 0 ? upcomingCount : 2}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left / Middle: Upcoming Sessions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Upcoming Sessions</h2>
              <span className="text-xs font-medium text-brand hover:underline cursor-pointer">View all &rarr;</span>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-sm font-semibold text-slate-700">No scheduled sessions</h3>
                <p className="mt-1 text-xs text-slate-500">Create a session and share the invite link to start mock interviews.</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Schedule Session
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => {
                  const isHost = session.hostId === user?.uid;
                  const hasPartner = !!session.guestId;
                  const partnerName = isHost ? (session.guestName || 'Waiting for peer...') : session.hostName;

                  return (
                    <div 
                      key={session.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-slate-100 p-3 shrink-0">
                          {getTopicIcon(session.topic)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{session.topicDetail}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <span className="font-semibold text-slate-700">Partner:</span> {partnerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" /> {session.date} at {session.time}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> {session.duration} mins
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
                        {/* If no partner and host, show Invite sharing link */}
                        {isHost && !hasPartner ? (
                          <button
                            onClick={() => handleCopyLink(session.inviteLink, session.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                          >
                            {copiedSessionId === session.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" /> Copied Link
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Invite Link
                              </>
                            )}
                          </button>
                        ) : null}

                        {/* If guest is empty and current user is NOT host, allow joining from dashboard list */}
                        {!isHost && !hasPartner ? (
                          <button
                            onClick={async () => {
                              if (!user) return;
                              await updateSession(session.id, {
                                guestId: user.uid,
                                guestName: profile?.displayName || user.displayName || 'Guest'
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Join Session
                          </button>
                        ) : null}

                        {/* Main enter button for the room */}
                        {hasPartner || isHost ? (
                          <button
                            onClick={() => navigate(`/room/${session.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-bold shadow-sm transition-all cursor-pointer"
                          >
                            Join Session <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Simulated Additional widgets to match visual weight of design */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Skill Progress */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Skill Progress</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Problem Solving</span>
                      <span className="font-semibold">85%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>System Design</span>
                      <span className="font-semibold">62%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: '62%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Prep */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Quick Prep</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">Ready for a quick 10-minute AI mock challenge to brush up on core questions?</p>
                </div>
                <button className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 text-xs font-semibold transition-all">
                  <Sparkles className="h-3.5 w-3.5 text-brand" /> Start AI Blitz
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Quick booking & activity */}
          <div className="space-y-6">
            {/* Quick Matchmaking & Solo Card */}
            <div className="rounded-xl bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md relative overflow-hidden border border-slate-800">
              <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-10">
                <Sparkles className="h-28 w-28 text-brand" />
              </div>
              <h3 className="text-sm font-bold flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-4.5 w-4.5 text-brand" /> Live Practice
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Match with a live peer instantly based on topics, or start a solo interview simulation with our AI interviewer.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => setIsMatchmakerOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" /> Find a partner now
                </button>
                <button
                  onClick={() => navigate('/solo')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white py-2.5 text-xs font-bold shadow-sm border border-slate-700 transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-brand" /> Practice solo
                </button>
              </div>
            </div>

            {/* Book card */}
            <div className="rounded-xl bg-slate-900 p-6 text-white shadow-sm relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                <Calendar className="h-32 w-32" />
              </div>
              <h3 className="text-lg font-bold">Level up your career.</h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Book a peer interview or professional review session today to perfect your system design and coding skills.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#99f6e4] hover:bg-[#5eead4] text-slate-900 py-2.5 text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Schedule New Session
              </button>
            </div>

            {/* Recent Activity Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-brand mt-1.5"></div>
                  <div>
                    <p className="text-xs text-slate-700 font-semibold">Mock interview with Priya M. completed</p>
                    <span className="text-[10px] text-slate-400">2 hours ago</span>
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Score: 8.2/10
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5"></div>
                  <div>
                    <p className="text-xs text-slate-700 font-semibold">Priya M. sent you a message</p>
                    <span className="text-[10px] text-slate-400">5 hours ago</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-amber-500 mt-1.5"></div>
                  <div>
                    <p className="text-xs text-slate-700 font-semibold">Profile badge "Solid Coder" earned</p>
                    <span className="text-[10px] text-slate-400">Yesterday</span>
                  </div>
                </div>
              </div>
              <button className="mt-4 w-full text-center text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors">
                See all activity
              </button>
            </div>

            {/* Tip of the Day */}
            <div className="rounded-xl border border-slate-200 bg-teal-50/20 p-5 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-teal-600 mb-2" />
              <p className="text-xs font-bold text-slate-800">Tip of the day</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed italic">
                "Always explain your thought process before writing code. Reviewers care more about clarity than syntax memorization."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULING MODAL CONTAINER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          {/* Overlay click to close */}
          <div className="fixed inset-0" onClick={() => setIsModalOpen(false)}></div>

          {/* Modal Card */}
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl z-10 transition-all scale-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Schedule a session</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all focus:outline-none"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSessionSubmit} className="mt-4 space-y-5">
              {/* Topic Select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Interview Topic</label>
                <div className="flex flex-wrap gap-2">
                  {(['DSA', 'System Design', 'Frontend', 'HR'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setModalTopic(t)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                        modalTopic === t
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time Input */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-brand focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</label>
                  <input
                    type="time"
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-brand focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Duration Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {([30, 45, 60] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setModalDuration(d)}
                      className={`rounded-lg py-2 text-xs font-bold border transition-all cursor-pointer ${
                        modalDuration === d
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Share Invite Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invite Link (Pre-generated)</label>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="text-xs font-mono truncate grow">
                    {window.location.origin}/room/{generatedSessionId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(`${window.location.origin}/room/${generatedSessionId}`, 'generated')}
                    className="p-1 hover:text-brand transition-colors text-slate-400"
                    title="Copy invite code"
                  >
                    {copiedSessionId === 'generated' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Confirm session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MATCHMAKING TOPIC SELECTOR MODAL */}
      {isMatchmakerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="fixed inset-0" onClick={() => setIsMatchmakerOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl z-10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Find a partner now</h3>
              <button 
                onClick={() => setIsMatchmakerOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all focus:outline-none"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Choose Topic</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['DSA', 'System Design', 'Frontend', 'HR'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMatchTopic(t)}
                      className={`rounded-lg py-2.5 text-xs font-bold border transition-all cursor-pointer ${
                        matchTopic === t
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMatchmakerOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartMatching}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Start matching
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MATCHMAKING WAITING SCREEN OVERLAY */}
      {isMatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center text-white shadow-2xl relative overflow-hidden">
            {matchingStatus === 'waiting' && (
              <div className="space-y-6">
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-brand/20 animate-ping" style={{ animationDuration: '2.5s' }}></div>
                  <div className="absolute inset-2 rounded-full border-2 border-brand/40 animate-ping" style={{ animationDuration: '2s' }}></div>
                  <div className="absolute inset-4 rounded-full border-2 border-brand/60 animate-ping" style={{ animationDuration: '1.5s' }}></div>
                  <div className="h-12 w-12 rounded-full bg-brand flex items-center justify-center animate-pulse">
                    <UserPlus className="h-6 w-6 text-white" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Looking for a partner…</h3>
                  <p className="text-xs text-slate-400">Topic: {matchTopic}</p>
                </div>

                <div className="rounded-lg bg-slate-900/60 py-2.5 border border-slate-800/80 text-xs font-semibold font-mono text-slate-300">
                  Time left: {Math.floor(matchTimeLeft / 60)}:{(matchTimeLeft % 60).toString().padStart(2, '0')}
                </div>

                <button
                  type="button"
                  onClick={() => handleCancelMatching(null, false)}
                  className="w-full rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 py-2.5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {matchingStatus === 'matched' && (
              <div className="space-y-5 py-2">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                  <Check className="h-8 w-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-400">Partner found!</h3>
                  <p className="text-xs text-slate-400">Creating collaborative sandbox session...</p>
                </div>
              </div>
            )}

            {matchingStatus === 'timeout' && (
              <div className="space-y-5">
                <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Plus className="h-8 w-8 rotate-45" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-red-400">No partner found, try again</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">We couldn't locate a peer matching your selected topic. Please start matchmaking again or invite a colleague directly.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMatching(false)}
                  className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white py-2.5 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};
