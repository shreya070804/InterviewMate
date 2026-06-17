import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { 
  createSession, 
  subscribeToUserSessions, 
  getUserFeedbackList,
  updateSession,
  deleteSession,
  addToMatchmakingQueue,
  removeFromMatchmakingQueue,
  subscribeToQueueItem,
  uploadAndParseResume,
  optInToLeaderboard,
  getUserSoloSessions
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
  Sparkles,
  Award, MoreHorizontal,
  CheckCircle2,
  Circle,
  X
} from 'lucide-react';

const detectSkills = (text?: string): string[] => {
  if (!text) return [];
  const skillsList = [
    'React', 'Python', 'Machine Learning', 'JavaScript', 'TypeScript', 'Java', 'C++',
    'Node.js', 'Express', 'SQL', 'NoSQL', 'AWS', 'Docker', 'System Design', 'Algorithms',
    'HTML', 'CSS', 'Tailwind', 'Next.js', 'TensorFlow', 'PyTorch', 'Git', 'Kubernetes'
  ];
  return skillsList.filter(skill => {
    try {
      const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const startBoundary = /^\w/.test(skill) ? '\\b' : '';
      const endBoundary = /\w$/.test(skill) ? '\\b' : '';
      const regex = new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'i');
      return regex.test(text);
    } catch (e) {
      return false;
    }
  });
};

export const Dashboard: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Resume Upload State
  const [isParsingResume, setIsParsingResume] = useState(false);

  // Leaderboard State
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [submittingOptIn, setSubmittingOptIn] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [rescheduleSessionId, setRescheduleSessionId] = useState<string | null>(null);

  // Onboarding Checklist State
  const [soloSessionsCount, setSoloSessionsCount] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`im_onboarding_dismissed_${user?.uid}`) === 'true';
  });
  const [localHasCompleted, setLocalHasCompleted] = useState(false);
  const hasInitializedCompleted = useRef(false);

  useEffect(() => {
    if (profile && !hasInitializedCompleted.current) {
      setLocalHasCompleted(!!profile.hasCompletedOnboarding);
      hasInitializedCompleted.current = true;
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      setIsOptedIn(!!profile.optedInLeaderboard);
    }
  }, [profile]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file.");
      return;
    }

    setIsParsingResume(true);
    try {
      // Read file as base64 using a Promise to await completion
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = reader.result as string;
          resolve(resultStr.split(',')[1]);
        };
        reader.onerror = (ev) => reject(ev);
        reader.readAsDataURL(file);
      });
      if (user) {
        const parsedText = await uploadAndParseResume(user.uid, base64Data);
        await updateProfile({ resumeText: parsedText });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse and upload resume.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleOptInToggle = async () => {
    if (!user || !profile) return;
    setSubmittingOptIn(true);
    try {
      const nextOptIn = !isOptedIn;
      await optInToLeaderboard(
        user.uid, 
        nextOptIn, 
        profile.displayName || user.displayName || 'Developer'
      );
      setIsOptedIn(nextOptIn);
    } catch (err) {
      console.error(err);
      alert("Failed to update leaderboard settings");
    } finally {
      setSubmittingOptIn(false);
    }
  };

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

    // Fetch user solo sessions count
    const fetchSoloSessions = async () => {
      try {
        const list = await getUserSoloSessions(user.uid);
        setSoloSessionsCount(list.length);
      } catch (err) {
        console.error("Failed to load solo sessions count:", err);
      }
    };
    fetchSoloSessions();

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

    const selectedDateTime = new Date(`${modalDate}T${modalTime}`);
    const now = new Date();
    if (selectedDateTime < now) {
      alert("Session date and time cannot be in the past");
      return;
    }

    const topicDetail = 
      modalTopic === 'DSA' ? 'Data Structures & Algorithms' : 
      modalTopic === 'System Design' ? 'System Design: Architecture' : 
      modalTopic === 'Frontend' ? 'Frontend Development' : 'HR & Behavioural';

    try {
      if (isRescheduleMode && rescheduleSessionId) {
        await updateSession(rescheduleSessionId, {
          topic: modalTopic,
          topicDetail,
          date: modalDate,
          time: modalTime,
          duration: modalDuration,
        });
      } else {
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
      }

      // Reset Modal
      setIsModalOpen(false);
      setIsRescheduleMode(false);
      setRescheduleSessionId(null);
      setModalDate('');
      setModalTime('');
      setModalDuration(45);
      setGeneratedSessionId('');
    } catch (err) {
      console.error(err);
      alert(isRescheduleMode ? "Failed to reschedule session" : "Failed to create session");
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

  const profileComplete = !!profile?.onboarded;
  const sessionScheduled = sessions.length > 0;
  const soloAttempted = soloSessionsCount > 0;
  const resumeUploaded = !!profile?.resumeText;

  const completedCount = [profileComplete, sessionScheduled, soloAttempted, resumeUploaded].filter(Boolean).length;
  const percentComplete = (completedCount / 4) * 100;

  // Background update once complete
  useEffect(() => {
    if (completedCount === 4 && user && !profile?.hasCompletedOnboarding) {
      updateProfile({ hasCompletedOnboarding: true }).catch(err => {
        console.error("Failed to mark onboarding as completed:", err);
      });
    }
  }, [completedCount, user, profile?.hasCompletedOnboarding]);

  const renderOnboardingChecklist = () => {
    if (localHasCompleted || dismissed || !user) return null;

    const handleDismiss = () => {
      localStorage.setItem(`im_onboarding_dismissed_${user.uid}`, 'true');
      setDismissed(true);
    };

    if (completedCount === 4) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 dark:border-indigo-500/20 bg-slate-900 text-white p-8 shadow-xl mb-8 transition-all duration-300 transform hover:scale-[1.005]">
          {/* Glowing background accent */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-500/20 blur-3xl pointer-events-none"></div>
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>

          <div className="flex items-start justify-between relative z-10">
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start text-center sm:text-left">
              {/* Badge Icon */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-teal-400 to-indigo-500 p-0.5 shadow-lg shrink-0 animate-bounce">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-900 text-teal-400">
                  <Sparkles className="h-6 w-6 text-teal-400" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-extrabold tracking-tight bg-linear-to-r from-teal-300 via-emerald-400 to-indigo-300 bg-clip-text text-transparent">
                  🎉 You're Ready to Ace Your Interviews!
                </h3>
                <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                  Outstanding job! You've completed your onboarding checklist: your profile is complete, your first session is scheduled, you've tried solo AI practice, and your resume is uploaded. You are fully equipped to launch your mock interviews and start tracking your skill gaps!
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                  <button
                    onClick={handleDismiss}
                    className="rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 hover:text-black font-extrabold px-6 py-2.5 text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-teal-500/20 cursor-pointer"
                  >
                    Start Interviewing
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="rounded-xl border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300 px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-800"
              title="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-md transition-colors duration-200 mb-8 text-left">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Getting Started Checklist
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Complete these 4 quick steps to fully configure your preparation workspace.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Dismiss Checklist"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-350">
            <span>Progress</span>
            <span className="font-mono text-slate-500 dark:text-slate-400">{completedCount} of 4 complete</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
            <div 
              className="h-full bg-linear-to-r from-teal-500 to-emerald-500 transition-all duration-500 rounded-full" 
              style={{ width: `${percentComplete}%` }}
            ></div>
          </div>
        </div>

        {/* Checklist Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div 
            onClick={() => { if (!profileComplete) navigate('/onboarding'); }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
              profileComplete 
                ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-100/30 dark:hover:bg-slate-850/30 cursor-pointer'
            }`}
          >
            {profileComplete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">Complete profile</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Select role and topics</p>
            </div>
          </div>

          {/* Step 2 */}
          <div 
            onClick={() => { 
              if (!sessionScheduled) {
                setIsRescheduleMode(false);
                setRescheduleSessionId(null);
                setModalDate('');
                setModalTime('');
                setModalDuration(45);
                setGeneratedSessionId(Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7));
                setIsModalOpen(true);
              }
            }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
              sessionScheduled 
                ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-100/30 dark:hover:bg-slate-850/30 cursor-pointer'
            }`}
          >
            {sessionScheduled ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-550 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">Schedule session</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Book peer mock session</p>
            </div>
          </div>

          {/* Step 3 */}
          <div 
            onClick={() => { if (!soloAttempted) navigate('/solo'); }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
              soloAttempted 
                ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-100/30 dark:hover:bg-slate-850/30 cursor-pointer'
            }`}
          >
            {soloAttempted ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">Try solo practice</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Mock interview with AI</p>
            </div>
          </div>

          {/* Step 4 */}
          <div 
            onClick={() => {
              if (!resumeUploaded) {
                const input = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
                input?.click();
              }
            }}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
              resumeUploaded 
                ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-100/30 dark:hover:bg-slate-850/30 cursor-pointer'
            }`}
          >
            {resumeUploaded ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-550 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">Upload resume</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Extract skills from PDF</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {renderOnboardingChecklist()}
        
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
                  onClick={() => {
                    setIsRescheduleMode(false);
                    setRescheduleSessionId(null);
                    setModalDate('');
                    setModalTime('');
                    setModalDuration(45);
                    setGeneratedSessionId(Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7));
                    setIsModalOpen(true);
                  }}
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
                          {isHost && !hasPartner && (
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
                          )}

                          {/* If guest is empty and current user is NOT host, allow joining from dashboard list */}
                          {!isHost && !hasPartner && (
                            <button
                              onClick={async () => {
                                if (!user) return;
                                await updateSession(session.id, {
                                  guestId: user.uid,
                                  guestName: profile?.displayName || user.displayName || 'Guest',
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-brand px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
                            >
                              <UserPlus className="h-3.5 w-3.5" /> Join Session
                            </button>
                          )}

                          {/* Main enter button for the room */}
                          {(hasPartner || isHost) && (
                            <button
                              onClick={() => navigate(`/room/${session.id}`)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-bold shadow-sm transition-all cursor-pointer"
                            >
                              Join Session <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}

                           {/* Dropdown menu for Reschedule / Cancel */}
                           <div className="relative font-sans">
                             <button
                               onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                               className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
                             >
                               <MoreHorizontal className="h-4 w-4" />
                             </button>
                             {menuOpenId === session.id && (
                               <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 overflow-hidden">
                                 <button
                                   onClick={() => {
                                     setIsRescheduleMode(true);
                                     setRescheduleSessionId(session.id);
                                     setModalTopic(session.topic as any);
                                     setModalDate(session.date);
                                     setModalTime(session.time);
                                     setModalDuration(session.duration as any);
                                     setGeneratedSessionId(session.id);
                                     setIsModalOpen(true);
                                     setMenuOpenId(null);
                                   }}
                                   className="block w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                 >
                                   Reschedule
                                 </button>
                                 <button
                                   onClick={async () => {
                                     if (window.confirm("Are you sure? Your partner will be notified.")) {
                                       await deleteSession(session.id);
                                     }
                                     setMenuOpenId(null);
                                   }}
                                   className="block w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 transition-colors cursor-pointer"
                                 >
                                   Cancel
                                 </button>
                               </div>
                             )}
                           </div>
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
                <button
                  onClick={() => navigate('/skills')}
                  className="mt-4 w-full text-center text-xs font-bold text-brand hover:underline cursor-pointer flex items-center justify-center gap-1"
                >
                  View Skill Gap Analysis &rarr;
                </button>
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

            {/* Resume Profile Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left transition-colors duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Copy className="h-4.5 w-4.5 text-brand" /> Resume Profile
                </h3>
                {profile?.resumeText ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded">
                    Empty
                  </span>
                )}
              </div>

              {isParsingResume ? (
                <div className="py-4 text-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent mx-auto mb-2"></div>
                  <p className="text-xs text-slate-500">Extracting text and updating profile...</p>
                </div>
              ) : profile?.resumeText ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Your resume is active. AI question generation will tailor questions to your projects and background.
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Detected skills</span>
                    <div className="flex flex-wrap gap-1">
                      {detectSkills(profile.resumeText).map((s: string) => (
                        <span key={s} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350 px-2 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className="block mt-3">
                    <span className="text-xs text-brand hover:underline font-bold cursor-pointer">
                      Replace Resume PDF
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleResumeUpload}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload your resume in PDF format to enable personalized questions tailored to your skills.
                  </p>
                  <label className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand dark:hover:border-brand rounded-xl py-5 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/50">
                    <div className="text-center">
                      <span className="text-xs font-bold text-brand block">Select PDF</span>
                      <span className="text-[9px] text-slate-400">Max size 2MB</span>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleResumeUpload}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Leaderboard Settings Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left transition-colors duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Award className="h-4.5 w-4.5 text-brand" /> Leaderboard Settings
                </h3>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Public Rank</p>
                  <p className="text-[10px] text-slate-400">Show me on the leaderboard</p>
                </div>
                <button
                  onClick={handleOptInToggle}
                  disabled={submittingOptIn}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isOptedIn ? 'bg-brand' : 'bg-slate-250 dark:bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isOptedIn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
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
                onClick={() => {
                  setIsRescheduleMode(false);
                  setRescheduleSessionId(null);
                  setModalDate('');
                  setModalTime('');
                  setModalDuration(45);
                  setGeneratedSessionId(Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7));
                  setIsModalOpen(true);
                }}
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
          <div className="fixed inset-0" onClick={() => {
            setIsModalOpen(false);
            setIsRescheduleMode(false);
            setRescheduleSessionId(null);
            setModalDate('');
            setModalTime('');
            setModalDuration(45);
            setGeneratedSessionId('');
          }}></div>

          {/* Modal Card */}
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl z-10 transition-all scale-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                {isRescheduleMode ? 'Reschedule session' : 'Schedule a session'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setIsRescheduleMode(false);
                  setRescheduleSessionId(null);
                  setModalDate('');
                  setModalTime('');
                  setModalDuration(45);
                  setGeneratedSessionId('');
                }}
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
                  <label htmlFor="modal-date" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
                  <input
                    id="modal-date"
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-brand focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="modal-time" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</label>
                  <input
                    id="modal-time"
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
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsRescheduleMode(false);
                    setRescheduleSessionId(null);
                    setModalDate('');
                    setModalTime('');
                    setModalDuration(45);
                    setGeneratedSessionId('');
                  }}
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
