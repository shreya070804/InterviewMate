import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  const [matchedPartnerName, setMatchedPartnerName] = useState<string | null>(null);
  const [matchedPartnerExp, setMatchedPartnerExp] = useState<string | null>(null);

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
    setMatchedPartnerName(null);
    setMatchedPartnerExp(null);

    try {
      const qId = await addToMatchmakingQueue(
        user.uid, 
        matchTopic, 
        profile?.displayName || user.displayName || 'Developer',
        profile?.experienceLevel || 'Student'
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
          setMatchedPartnerName(data.partnerName || 'Practice Partner');
          setMatchedPartnerExp(data.partnerExperienceLevel || '1-3 yrs');
          setMatchingStatus('matched');
          if (queueListenerRef.current) {
            queueListenerRef.current();
            queueListenerRef.current = null;
          }
          
          setTimeout(() => {
            setIsMatching(false);
            navigate(`/room/${data.sessionId}`);
          }, 4000);
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
                  {t('dashboard.onboarding_ready_title')}
                </h3>
                <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                  {t('dashboard.onboarding_ready_desc')}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                  <button
                    onClick={handleDismiss}
                    className="rounded-xl bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 hover:text-black font-extrabold px-6 py-2.5 text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-teal-500/20 cursor-pointer"
                  >
                    {t('dashboard.start_interviewing')}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="rounded-xl border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300 px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                  >
                    {t('dashboard.dismiss')}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-slate-800"
              title={t('dashboard.dismiss')}
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
              {t('dashboard.getting_started')}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t('dashboard.getting_started_desc')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={t('dashboard.dismiss')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-350">
            <span>{t('dashboard.progress')}</span>
            <span className="font-mono text-slate-500 dark:text-slate-400">{t('dashboard.complete_count_msg', { completed: completedCount })}</span>
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
              <p className="text-xs font-bold">{t('dashboard.complete_profile')}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.complete_profile_desc')}</p>
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
              <p className="text-xs font-bold">{t('dashboard.schedule_session')}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.schedule_session_desc')}</p>
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
              <CheckCircle2 className="h-5 w-5 text-emerald-550 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold">{t('dashboard.try_solo')}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.try_solo_desc')}</p>
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
              <p className="text-xs font-bold">{t('dashboard.upload_resume')}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.upload_resume_desc')}</p>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('dashboard.total_sessions')}</p>
              <p className="text-2xl font-bold text-slate-800">{totalSessions > 0 ? totalSessions : 12}</p>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('dashboard.average_score')}</p>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-light/75">{t('dashboard.upcoming_sessions')}</p>
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
              <h2 className="text-lg font-bold text-slate-800">{t('dashboard.upcoming_sessions')}</h2>
              <span className="text-xs font-medium text-brand hover:underline cursor-pointer">{t('dashboard.view_all')} &rarr;</span>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
              </div>
            ) : sessions.length === 0 ? (
               <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                 <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                 <h3 className="mt-4 text-sm font-semibold text-slate-700">{t('dashboard.no_sessions')}</h3>
                 <p className="mt-1 text-xs text-slate-500">{t('dashboard.no_sessions_desc')}</p>
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
                   <Plus className="h-4 w-4" /> {t('dashboard.schedule_session_btn')}
                 </button>
               </div>
             ) : (
               <div className="space-y-4">
                 {sessions.map((session) => {
                   const isHost = session.hostId === user?.uid;
                   const hasPartner = !!session.guestId;
                   const partnerName = isHost ? (session.guestName || t('dashboard.waiting_peer')) : session.hostName;

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
                               <span className="font-semibold text-slate-700">{t('dashboard.partner')}:</span> {partnerName}
                             </span>
                             <span className="flex items-center gap-1">
                               <Calendar className="h-3.5 w-3.5" /> {session.date} {t('dashboard.at')} {session.time}
                             </span>
                             <span className="flex items-center gap-1">
                               <Clock className="h-3.5 w-3.5" /> {session.duration} {t('dashboard.mins')}
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
                                   <Check className="h-3.5 w-3.5 text-green-600" /> {t('dashboard.copied_link')}
                                 </>
                               ) : (
                                 <>
                                   <Copy className="h-3.5 w-3.5" /> {t('dashboard.invite_link')}
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
                               <UserPlus className="h-3.5 w-3.5" /> {t('dashboard.join_session')}
                             </button>
                           )}

                           {/* Main enter button for the room */}
                           {(hasPartner || isHost) && (
                             <button
                               onClick={() => navigate(`/room/${session.id}`)}
                               className="inline-flex items-center gap-1 rounded-lg bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-bold shadow-sm transition-all cursor-pointer"
                             >
                               {t('dashboard.join_session')} <ArrowRight className="h-3.5 w-3.5" />
                             </button>
                           )}

                            {/* Dropdown menu for Reschedule / Cancel */}
                            <div className="relative font-sans">
                              <button
                                onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
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
                                    {t('dashboard.reschedule')}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(t('dashboard.confirm_cancel_prompt'))) {
                                        await deleteSession(session.id);
                                      }
                                      setMenuOpenId(null);
                                    }}
                                    className="block w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 transition-colors cursor-pointer"
                                  >
                                    {t('dashboard.cancel')}
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
                <h3 className="text-sm font-bold text-slate-800 mb-4">{t('dashboard.skill_progress')}</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t('dashboard.problem_solving')}</span>
                      <span className="font-semibold">85%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t('dashboard.system_design')}</span>
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
                  {t('dashboard.view_skill_gap')} &rarr;
                </button>
              </div>

              {/* Quick Prep */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2">{t('dashboard.quick_prep')}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('dashboard.quick_prep_desc')}</p>
                </div>
                <button className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 text-xs font-semibold transition-all">
                  <Sparkles className="h-3.5 w-3.5 text-brand" /> {t('dashboard.start_ai_blitz')}
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
                <Sparkles className="h-4.5 w-4.5 text-brand" /> {t('dashboard.live_practice')}
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {t('dashboard.live_practice_desc')}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => setIsMatchmakerOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" /> {t('dashboard.find_partner_btn')}
                </button>
                <button
                  onClick={() => navigate('/solo')}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white py-2.5 text-xs font-bold shadow-sm border border-slate-700 transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-brand" /> {t('dashboard.practice_solo_btn')}
                </button>
              </div>
            </div>

            {/* Resume Profile Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-left transition-colors duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Copy className="h-4.5 w-4.5 text-brand" /> {t('dashboard.resume_profile')}
                </h3>
                {profile?.resumeText ? (
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                    {t('dashboard.active')}
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded">
                    {t('dashboard.empty')}
                  </span>
                )}
              </div>

              {isParsingResume ? (
                <div className="py-4 text-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent mx-auto mb-2"></div>
                  <p className="text-xs text-slate-500">{t('dashboard.extracting_text')}</p>
                </div>
              ) : profile?.resumeText ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('dashboard.resume_active_desc')}
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">{t('dashboard.detected_skills')}</span>
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
                      {t('dashboard.replace_resume')}
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
                    {t('dashboard.resume_empty_desc')}
                  </p>
                  <label className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand dark:hover:border-brand rounded-xl py-5 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-900/50">
                    <div className="text-center">
                      <span className="text-xs font-bold text-brand block">{t('dashboard.select_pdf')}</span>
                      <span className="text-[9px] text-slate-405">{t('dashboard.max_size')}</span>
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
                  <Award className="h-4.5 w-4.5 text-brand" /> {t('dashboard.leaderboard_settings')}
                </h3>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{t('dashboard.public_rank')}</p>
                  <p className="text-[10px] text-slate-400">{t('dashboard.show_on_leaderboard')}</p>
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
              <h3 className="text-lg font-bold">{t('dashboard.level_up_career')}</h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                {t('dashboard.level_up_desc')}
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
                <Plus className="h-4 w-4" /> {t('dashboard.schedule_new_session_btn')}
              </button>
            </div>

            {/* Recent Activity Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">{t('dashboard.recent_activity')}</h3>
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
                {t('dashboard.see_all_activity')}
              </button>
            </div>

            {/* Tip of the Day */}
            <div className="rounded-xl border border-slate-200 bg-teal-50/20 p-5 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-teal-600 mb-2" />
              <p className="text-xs font-bold text-slate-800">{t('dashboard.tip_of_the_day')}</p>
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
                {isRescheduleMode ? t('scheduling_form.reschedule_title') : t('scheduling_form.schedule_title')}
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
                aria-label={t('scheduling_form.cancel')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-655 transition-all focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
              >
                <Plus className="h-5 w-5 rotate-45" aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSessionSubmit} className="mt-4 space-y-5">
              {/* Topic Select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('scheduling_form.interview_topic')}</label>
                <div className="flex flex-wrap gap-2">
                  {(['DSA', 'System Design', 'Frontend', 'HR'] as const).map((tVal, idx, arr) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setModalTopic(tVal)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nextIdx = (idx + 1) % arr.length;
                          setModalTopic(arr[nextIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[nextIdx]) {
                            (buttons[nextIdx] as HTMLButtonElement).focus();
                          }
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prevIdx = (idx - 1 + arr.length) % arr.length;
                          setModalTopic(arr[prevIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[prevIdx]) {
                            (buttons[prevIdx] as HTMLButtonElement).focus();
                          }
                        }
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
                        modalTopic === tVal
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-605 hover:bg-slate-100'
                      }`}
                    >
                      {tVal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time Input */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="modal-date" className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('scheduling_form.date')}</label>
                  <input
                    id="modal-date"
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-brand focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="modal-time" className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('scheduling_form.time')}</label>
                  <input
                    id="modal-time"
                    type="time"
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 focus:border-brand focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>
              </div>

              {/* Duration Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('scheduling_form.duration')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {([30, 45, 60] as const).map((d, idx, arr) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setModalDuration(d)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nextIdx = (idx + 1) % arr.length;
                          setModalDuration(arr[nextIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[nextIdx]) {
                            (buttons[nextIdx] as HTMLButtonElement).focus();
                          }
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prevIdx = (idx - 1 + arr.length) % arr.length;
                          setModalDuration(arr[prevIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[prevIdx]) {
                            (buttons[prevIdx] as HTMLButtonElement).focus();
                          }
                        }
                      }}
                      className={`rounded-lg py-2 text-xs font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
                        modalDuration === d
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t('scheduling_form.min_label', { count: d })}
                    </button>
                  ))}
                </div>
              </div>

              {/* Share Invite Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('scheduling_form.invite_link_pregen')}</label>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                  <span className="text-xs font-mono truncate grow">
                    {window.location.origin}/room/{generatedSessionId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(`${window.location.origin}/room/${generatedSessionId}`, 'generated')}
                    className="p-1 hover:text-brand transition-colors text-slate-400 focus-visible:ring-2 focus-visible:ring-brand focus:outline-none rounded"
                    title={t('scheduling_form.copy_invite_code')}
                    aria-label={t('scheduling_form.copy_invite_code')}
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
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 cursor-pointer"
                >
                  {t('scheduling_form.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {t('scheduling_form.confirm_session')}
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
              <h3 className="text-lg font-bold text-slate-800">{t('matchmaker.title')}</h3>
              <button 
                onClick={() => setIsMatchmakerOpen(false)}
                aria-label={t('matchmaker.cancel')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
              >
                <Plus className="h-5 w-5 rotate-45" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('matchmaker.choose_topic')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['DSA', 'System Design', 'Frontend', 'HR'] as const).map((tVal, idx, arr) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setMatchTopic(tVal)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const nextIdx = (idx + 1) % arr.length;
                          setMatchTopic(arr[nextIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[nextIdx]) {
                            (buttons[nextIdx] as HTMLButtonElement).focus();
                          }
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          const prevIdx = (idx - 1 + arr.length) % arr.length;
                          setMatchTopic(arr[prevIdx]);
                          const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                          if (buttons && buttons[prevIdx]) {
                            (buttons[prevIdx] as HTMLButtonElement).focus();
                          }
                        }
                      }}
                      className={`rounded-lg py-2.5 text-xs font-bold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
                        matchTopic === tVal
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tVal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMatchmakerOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-50 cursor-pointer"
                >
                  {t('matchmaker.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleStartMatching}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {t('matchmaker.start_matching')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MATCHMAKING WAITING SCREEN OVERLAY */}
      {isMatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-slate-888 bg-[#0f172a] p-8 text-center text-white shadow-2xl relative overflow-hidden">
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
                  <h3 className="text-lg font-bold">{t('matchmaker.looking_for_partner')}</h3>
                  <p className="text-xs text-slate-400">{t('matchmaker.topic_label', { topic: matchTopic })}</p>
                </div>

                <div className="rounded-lg bg-slate-900/60 py-2.5 border border-slate-800/80 text-xs font-semibold font-mono text-slate-300">
                  {t('matchmaker.time_left', { time: `${Math.floor(matchTimeLeft / 60)}:${(matchTimeLeft % 60).toString().padStart(2, '0')}` })}
                </div>

                <button
                  type="button"
                  onClick={() => handleCancelMatching(null, false)}
                  className="w-full rounded-lg border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-400 py-2.5 transition-colors cursor-pointer"
                >
                  {t('matchmaker.cancel')}
                </button>
              </div>
            )}

            {matchingStatus === 'matched' && (
              <div className="space-y-5 py-2">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                  <Check className="h-8 w-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-400">{t('matchmaker.partner_found')}</h3>
                  <div className="mt-3 inline-flex flex-col items-center justify-center rounded-xl bg-slate-900 px-6 py-4 border border-slate-800">
                    <span className="text-sm font-bold text-white">{matchedPartnerName}</span>
                    <span className="mt-1.5 inline-block rounded-full bg-brand/20 px-2.5 py-0.5 text-2xs font-extrabold text-brand uppercase tracking-wider">
                      Exp: {matchedPartnerExp}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">{t('matchmaker.creating_sandbox')}</p>
                </div>
              </div>
            )}

            {matchingStatus === 'timeout' && (
              <div className="space-y-5">
                <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Plus className="h-8 w-8 rotate-45" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-red-400">{t('matchmaker.no_partner_found')}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t('matchmaker.no_partner_desc')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMatching(false)}
                  className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white py-2.5 transition-colors cursor-pointer"
                >
                  {t('matchmaker.dismiss')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};
