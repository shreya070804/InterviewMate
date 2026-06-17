import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { 
  subscribeToSession, 
  updateSession, 
  getQuestions, 
  saveFeedback, 
  saveQuestion,
  getUserProfile,
  MOCK_MODE,
  sendChatMessage,
  subscribeToChatMessages,
  checkApiUsage,
  incrementApiUsage,
  showToast
} from '../firebase';
import type { Session, Question, UserProfile } from '../types';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Play, 
  Terminal, 
  Brain, 
  Clock, 
  Monitor,
  HelpCircle,
  Code,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Save,
  RotateCw,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import "@excalidraw/excalidraw/index.css";

const Editor = React.lazy(() => import('@monaco-editor/react'));
const Excalidraw = React.lazy(() =>
  import('@excalidraw/excalidraw').then((module) => ({ default: module.Excalidraw }))
);

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';

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

const MOCK_CANDIDATE_RESUME = `
SHREYA SHARMA
Software Engineering Candidate
Email: shreya@example.com | GitHub: github.com/shreya

TECHNICAL SKILLS:
- Languages: Python, JavaScript, TypeScript, Java, C++
- Frontend: React, HTML5, CSS3, Tailwind CSS, Next.js
- Backend & Cloud: Node.js, Express, Firebase Firestore, AWS (S3, EC2), Docker
- Domain: Machine Learning, Data Structures & Algorithms, System Design

PROJECTS:
1. COLLABORATIVE IDE (React, Node.js, Socket.io, Firebase)
- Developed a real-time collaborative coding sandbox with synced text inputs and execution runtimes.
- Built a secure client-side Monaco Editor container running execution checks.

2. PREDICTIVE HEALTHCARE ANALYTICS (Python, Machine Learning, TensorFlow, Pandas)
- Trained neural network models to predict health metrics from unstructured logs with 92% correctness.
- Optimized spatial footprint of dataset parsing structures.
`;

export const InterviewRoom: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'DSA' | 'System Design' | 'Frontend' | 'HR'>('All');

  // Candidate resume & Voice answers states
  const [candidateProfile, setCandidateProfile] = useState<UserProfile | null>(null);
  const [tailorToResume, setTailorToResume] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [localTranscript, setLocalTranscript] = useState('');
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const recognitionRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Custom Question Form State
  const [isCustomQuestionOpen, setIsCustomQuestionOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCategory, setCustomCategory] = useState<'DSA' | 'System Design' | 'Frontend' | 'HR'>('DSA');
  const [customDifficulty, setCustomDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  const handleCreateCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customDesc.trim()) return;

    const newQ: Question = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      description: customDesc.trim(),
      category: customCategory,
      difficulty: customDifficulty
    };

    setQuestions(prev => [newQ, ...prev]);
    // Reset Form
    setCustomTitle('');
    setCustomDesc('');
    setIsCustomQuestionOpen(false);
  };
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(2700); // Default 45 mins in seconds

  // Video State
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  
  // Mock Video Fallback Streams (if no Agora App ID)
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Code Editor State
  const [code, setCode] = useState<string>('// Enter your solution here\n\nfunction solve() {\n  \n}');
  const [language, setLanguage] = useState<string>('javascript');
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef<any>(null);
  const isIncomingChange = useRef<boolean>(false);

  // Synced Code Execution Output
  const [lastOutput, setLastOutput] = useState<{
    stdout?: string;
    stderr?: string;
    compileOutput?: string;
    status: 'success' | 'error' | 'compile_error' | 'timeout' | 'idle';
  } | null>(null);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  // Shared Whiteboard Mode
  const [activeMode, setActiveMode] = useState<'code' | 'whiteboard'>('code');
  const excalidrawRef = useRef<any>(null);
  const isIncomingWhiteboardChange = useRef<boolean>(false);
  const whiteboardTimeoutRef = useRef<any>(null);

  // AI Question Generator Form State
  const [isAIQuestionOpen, setIsAIQuestionOpen] = useState(false);
  const [jobRole, setJobRole] = useState('');
  const [genDifficulty, setGenDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);

  // Chat Sidebar States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isChatOpenRef = useRef(isChatOpen);
  const initialLoadRef = useRef(true);
  const chatMessagesRef = useRef<any[]>([]);

  // Keep refs in sync
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isChatOpen]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Subscribe to Chat messages subcollection
  useEffect(() => {
    if (!sessionId || !user) return;

    const unsubscribeChat = subscribeToChatMessages(sessionId, (msgs) => {
      if (initialLoadRef.current) {
        setChatMessages(msgs);
        initialLoadRef.current = false;
      } else {
        if (!isChatOpenRef.current) {
          const currentLength = chatMessagesRef.current.length;
          const newMsgs = msgs.slice(currentLength);
          const incomingCount = newMsgs.filter(m => m.senderId !== user.uid).length;
          if (incomingCount > 0) {
            setUnreadCount(prev => prev + incomingCount);
          }
        }
        setChatMessages(msgs);
      }
    });

    return () => unsubscribeChat();
  }, [sessionId, user?.uid]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !sessionId || !user) return;

    const text = chatInput.trim();
    setChatInput('');

    try {
      const senderName = profile?.displayName || user.displayName || 'Partner';
      await sendChatMessage(sessionId, text, user.uid, senderName);
    } catch (err) {
      console.error("Failed to send chat message:", err);
    }
  };

  const formatMsgTime = (timestampStr: string): string => {
    try {
      const d = new Date(timestampStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Load session data & Questions
  useEffect(() => {
    if (!sessionId || !user) return;

    // Fetch Questions
    getQuestions().then(setQuestions).catch(console.error);

    // Subscribe to session changes
    const unsubscribe = subscribeToSession(sessionId, (updatedSession) => {
      if (!updatedSession) {
        alert("Session not found or deleted");
        navigate('/');
        return;
      }

      setSession(updatedSession);

      // Synced Code
      if (updatedSession.code !== undefined && updatedSession.code !== code) {
        isIncomingChange.current = true;
        setCode(updatedSession.code);
        if (editorRef.current) {
          editorRef.current.setValue(updatedSession.code);
        }
        setTimeout(() => { isIncomingChange.current = false; }, 50);
      }

      // Synced Language
      if (updatedSession.language && updatedSession.language !== language) {
        setLanguage(updatedSession.language);
      }

      // Synced Active Mode (Code vs Whiteboard)
      if (updatedSession.activeMode && updatedSession.activeMode !== activeMode) {
        setActiveMode(updatedSession.activeMode);
      }

      // Synced Whiteboard Elements
      if (updatedSession.whiteboard && excalidrawRef.current) {
        isIncomingWhiteboardChange.current = true;
        excalidrawRef.current.updateScene({
          elements: updatedSession.whiteboard.elements,
          appState: {
            theme: updatedSession.whiteboard.appState?.theme || 'dark',
            viewBackgroundColor: updatedSession.whiteboard.appState?.viewBackgroundColor || '#121212'
          }
        });
        setTimeout(() => {
          isIncomingWhiteboardChange.current = false;
        }, 100);
      }

      // Synced Console Output
      if (updatedSession.lastOutput !== undefined) {
        setLastOutput(updatedSession.lastOutput);
      }

      // Calculate time left from creation time
      if (updatedSession.createdAt) {
        const createdTime = new Date(updatedSession.createdAt).getTime();
        const durationMs = updatedSession.duration * 60 * 1000;
        const now = Date.now();
        const elapsed = now - createdTime;
        const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));
        setTimeLeft(remaining);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId, user]);

  // Load candidate profile
  useEffect(() => {
    const fetchCandidateProfile = async () => {
      if (!session) return;
      if (session.hostId === user?.uid && session.guestId) {
        try {
          const prof = await getUserProfile(session.guestId);
          setCandidateProfile(prof);
        } catch (e) {
          console.error("Error fetching guest profile", e);
        }
      } else {
        setCandidateProfile(profile);
      }
    };
    fetchCandidateProfile();
  }, [session?.guestId, session?.hostId, user?.uid, profile]);

  // Countdown timer clock
  useEffect(() => {
    if (timeLeft <= 0) {
      handleEndInterview();
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft]);

  // Format Time (MM:SS)
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Video stream initialization (Agora vs Mock WebRTC local camera)
  useEffect(() => {
    if (!sessionId || !user) return;

    let localTracks: any[] = [];
    let client: IAgoraRTCClient | null = null;

    const setupAgora = async () => {
      try {
        const clientInstance = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        client = clientInstance;

        // Join Agora Channel
        // Use app ID, channel = sessionId, token = null (for testing mode), uid = random/uid
        await clientInstance.join(AGORA_APP_ID, sessionId, null, user.uid);

        // Create & Publish Local Tracks
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracks = [audioTrack, videoTrack];
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);

        // Render local video track in the element
        videoTrack.play('local-stream-container');

        await clientInstance.publish(localTracks);
        console.log("Published local Agora tracks successfully");

        // Handle remote users
        clientInstance.on('user-published', async (remoteUser, mediaType) => {
          await clientInstance.subscribe(remoteUser, mediaType);
          
          if (mediaType === 'video') {
            setRemoteUsers(prev => [...prev.filter(u => u.uid !== remoteUser.uid), remoteUser]);
            // Wait for DOM to render the container
            setTimeout(() => {
              remoteUser.videoTrack?.play(`remote-stream-${remoteUser.uid}`);
            }, 300);
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play();
          }
        });

        clientInstance.on('user-unpublished', (remoteUser) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid));
        });

      } catch (err) {
        console.error("Agora setup failed, falling back to Local Camera Mockup:", err);
        setupLocalMockCamera();
      }
    };

    const setupLocalMockCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Camera/Mic permission denied, rendering fallback profile image:", err);
      }
    };

    if (AGORA_APP_ID) {
      setupAgora();
    } else {
      setupLocalMockCamera();
    }

    return () => {
      // Cleanup tracks
      localTracks.forEach(track => {
        track.stop();
        track.close();
      });
      if (client) {
        (client as IAgoraRTCClient).leave();
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, user]);

  // Controls triggers
  const toggleMute = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!micActive);
    }
    if (cameraStream) {
      cameraStream.getAudioTracks().forEach(t => t.enabled = !micActive);
    }
    setMicActive(!micActive);
  };

  const toggleCamera = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!cameraActive);
    }
    if (cameraStream) {
      cameraStream.getVideoTracks().forEach(t => t.enabled = !cameraActive);
    }
    setCameraActive(!cameraActive);
  };

  // Editor configuration
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    // Set initial value
    if (session?.code) {
      editor.setValue(session.code);
    }
  };

  // Sync Code changes
  const handleEditorChange = (value: string | undefined) => {
    if (isIncomingChange.current || !sessionId) return;
    const newCode = value || '';
    setCode(newCode);

    // Save/Sync to database
    updateSession(sessionId, { code: newCode });
  };

  // Sync Language changes
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (sessionId) {
      updateSession(sessionId, { language: newLang });
    }
  };

  // Question selection
  const handleQuestionSelect = (qId: string) => {
    if (sessionId) {
      updateSession(sessionId, { activeQuestionId: qId });
      setIsQuestionPickerOpen(false);
    }
  };

  // Run Code via Judge0
  const runCode = async () => {
    if (!sessionId) return;
    setIsRunning(true);
    
    // Sync idle status to session so both users see loading
    updateSession(sessionId, {
      lastOutput: { status: 'idle' }
    });

    const languageIdMap: { [key: string]: number } = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 54
    };

    const apiKey = localStorage.getItem('im_judge0_key') || import.meta.env.VITE_JUDGE0_API_KEY || import.meta.env.VITE_RAPIDAPI_KEY || '';

    // Enforce 10s Timeout AbortController signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      updateSession(sessionId, {
        lastOutput: {
          status: 'timeout',
          stderr: 'Execution timed out (exceeded 10 seconds).'
        }
      });
      setIsRunning(false);
    }, 10000);

    if (apiKey) {
      try {
        const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
          signal: controller.signal,
          body: JSON.stringify({
            source_code: btoa(unescape(encodeURIComponent(code))),
            language_id: languageIdMap[language] || 63,
            stdin: ''
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('RapidAPI response failed');
        }

        const data = await response.json();
        
        const stdout = data.stdout ? atob(data.stdout) : '';
        const stderr = data.stderr ? atob(data.stderr) : '';
        const compileOutput = data.compile_output ? atob(data.compile_output) : '';
        const statusId = data.status?.id;

        let status: 'success' | 'error' | 'compile_error' | 'timeout' = 'success';
        if (statusId === 6) status = 'compile_error';
        else if (statusId >= 7 && statusId <= 12) status = 'error';
        else if (statusId === 5) status = 'timeout';

        updateSession(sessionId, {
          lastOutput: { stdout, stderr, compileOutput, status }
        });
        setIsRunning(false);
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Judge0 API failed, utilizing local code execution simulator:', err);
        Sentry.captureException(err, { tags: { feature: 'code-execution' } });
      }
    }

    // High fidelity simulator fallback
    setTimeout(() => {
      clearTimeout(timeoutId);
      try {
        if (language === 'javascript') {
          const logBuffer: string[] = [];
          const customConsole = {
            log: (...args: any[]) => {
              logBuffer.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
            },
            error: (...args: any[]) => {
              logBuffer.push("[ERROR] " + args.join(' '));
            }
          };

          const runFn = new Function('console', code);
          runFn(customConsole);

          updateSession(sessionId, {
            lastOutput: {
              stdout: logBuffer.length > 0 ? logBuffer.join('\n') : 'Code executed successfully with no logs.',
              status: 'success'
            }
          });
        } else {
          updateSession(sessionId, {
            lastOutput: {
              stdout: `[Execution Simulation for ${language.toUpperCase()}]\nCode executed successfully in mock local sandbox.\nReturned exit code 0.`,
              status: 'success'
            }
          });
        }
      } catch (err: any) {
        updateSession(sessionId, {
          lastOutput: {
            stderr: err.message,
            status: 'error'
          }
        });
      } finally {
        setIsRunning(false);
      }
    }, 800);
  };

  // Excalidraw Whiteboard Changes Synced Debounced
  const handleWhiteboardChange = (elements: readonly any[], appState: any) => {
    if (isIncomingWhiteboardChange.current || !sessionId) return;

    if (whiteboardTimeoutRef.current) {
      clearTimeout(whiteboardTimeoutRef.current);
    }

    whiteboardTimeoutRef.current = setTimeout(() => {
      const activeElements = elements.map((el: any) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        angle: el.angle,
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        fillStyle: el.fillStyle,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        roughness: el.roughness,
        opacity: el.opacity,
        groupIds: el.groupIds,
        frameId: el.frameId,
        roundness: el.roundness,
        seed: el.seed,
        version: el.version,
        versionNonce: el.versionNonce,
        isDeleted: el.isDeleted,
        points: el.points,
        text: el.text,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        textAlign: el.textAlign,
        verticalAlign: el.verticalAlign,
        containerId: el.containerId,
        originalText: el.originalText,
        updated: el.updated,
        link: el.link
      }));

      updateSession(sessionId, {
        whiteboard: {
          elements: activeElements,
          appState: {
            theme: appState.theme,
            viewBackgroundColor: appState.viewBackgroundColor
          }
        }
      });
    }, 500);
  };

  // Voice Recording and Evaluation Handlers
  const startRecording = () => {
    recordingStartTimeRef.current = Date.now();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsRecording(true);
      setLocalTranscript("Starting mock voice recording... Speak now.");
      simulateMockVoiceAnswering();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setLocalTranscript('');
      if (sessionId) {
        updateSession(sessionId, { hrTranscript: '', hrScores: null });
      }
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        setLocalTranscript(finalTranscript);
        if (sessionId) {
          updateSession(sessionId, { hrTranscript: finalTranscript });
        }
      }
    };

    recognition.onerror = (err: any) => {
      console.error("Speech recognition error", err);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const simulateMockVoiceAnswering = () => {
    recordingStartTimeRef.current = Date.now();
    const mockPhrases = [
      "So, um, in my last project, we had a major deadline slippage because, uh, two team members left.",
      "The task was to, like, rewrite the entire onboarding flow in under two weeks.",
      "So I took the initiative to set up a daily standup, and you know, coordinate task delegations.",
      "In the end, we managed to deploy the system on time with zero bugs, which was, uh, a great result."
    ];
    let index = 0;
    let currentText = '';
    const interval = setInterval(() => {
      if (index < mockPhrases.length) {
        currentText += (currentText ? ' ' : '') + mockPhrases[index];
        setLocalTranscript(currentText);
        if (sessionId) {
          updateSession(sessionId, { hrTranscript: currentText });
        }
        index++;
      } else {
        clearInterval(interval);
        setIsRecording(false);
        const duration = Math.max(1, (Date.now() - recordingStartTimeRef.current) / 1000);
        analyzeVoiceAnswer(currentText, duration);
      }
    }, 2000);
    recognitionRef.current = { stop: () => clearInterval(interval) };
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    const duration = Math.max(1, (Date.now() - recordingStartTimeRef.current) / 1000);
    analyzeVoiceAnswer(undefined, duration);
  };

  const analyzeVoiceAnswer = async (textOverride?: string, durationSeconds?: number) => {
    const transcriptToAnalyze = textOverride !== undefined ? textOverride : localTranscript || session?.hrTranscript || '';
    if (!transcriptToAnalyze.trim()) return;

    setIsAnalyzingVoice(true);
    const apiKey = localStorage.getItem('im_claude_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

    const duration = durationSeconds || 15;
    const wordCount = transcriptToAnalyze.trim().split(/\s+/).length;
    const wpm = Math.round((wordCount / duration) * 60);

    const fillerWords = ['um', 'uh', 'like', 'you know'];
    let fillerCount = 0;
    fillerWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = transcriptToAnalyze.match(regex);
      if (matches) {
        fillerCount += matches.length;
      }
    });

    if (apiKey) {
      try {
        if (user) {
          await checkApiUsage(user.uid);
        }
      } catch (err: any) {
        showToast(err.message || "Daily AI usage limit reached, resets at midnight", "error");
        setIsAnalyzingVoice(false);
        return;
      }
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-html-user-override': 'true'
          } as any,
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: `Given this transcript and a speaking pace of ${wpm} words per minute, assess confidence level. Ideal pace is 130-160 wpm. Transcript: "${transcriptToAnalyze}". Return JSON with: pace_assessment (too fast/ideal/too slow), confidence_score (1-10), specific_feedback (1-2 sentences about pacing and tone based on word choice).`
              }
            ],
            system: "You are an expert HR interviewer. Analyze the provided spoken transcript. Respond ONLY with a valid JSON object containing: clarity_score (number 1-10), structure_score (number 1-10 based on STAR structure), filler_word_count (number), feedback (string, exactly 2 sentences), confidence_score (number 1-10), pace_assessment (string: 'too fast', 'ideal', or 'too slow'), and specific_feedback (string, 1-2 sentences about pacing and tone based on word choice)."
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (user) {
            await incrementApiUsage(user.uid);
          }

          const jsonText = data.content[0].text;
          const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          if (sessionId) {
            await updateSession(sessionId, {
              hrScores: {
                clarity_score: parsed.clarity_score || 7,
                structure_score: parsed.structure_score || 7,
                filler_word_count: parsed.filler_word_count !== undefined ? parsed.filler_word_count : fillerCount,
                feedback: parsed.feedback || 'Good communication flow.',
                confidence_score: parsed.confidence_score || 8,
                wpm: wpm,
                pace_assessment: parsed.pace_assessment || (wpm < 130 ? 'too slow' : wpm > 160 ? 'too fast' : 'ideal'),
                specific_feedback: parsed.specific_feedback || 'Steady pacing and structured answer formulation.'
              }
            });
          }
          setIsAnalyzingVoice(false);
          return;
        }
      } catch (err) {
        console.warn("Claude voice evaluation failed, utilizing offline evaluator:", err);
        Sentry.captureException(err, { tags: { feature: 'feedback-generation' } });
      }
    }

    // High fidelity offline mock assessment
    setTimeout(() => {
      const lower = transcriptToAnalyze.toLowerCase();
      let starScore = 5;
      if (lower.includes('situation') || lower.includes('background') || lower.includes('project')) starScore += 1.5;
      if (lower.includes('task') || lower.includes('deadline') || lower.includes('goal')) starScore += 1.5;
      if (lower.includes('action') || lower.includes('managed') || lower.includes('initiative') || lower.includes('started')) starScore += 1.5;
      if (lower.includes('result') || lower.includes('end') || lower.includes('output') || lower.includes('metrics')) starScore += 1.5;
      starScore = Math.min(10, Math.max(1, starScore));

      const clarityScore = Math.min(10, Math.max(1, Math.round(9 - (fillerCount * 0.7))));

      let confidenceScore = 8;
      if (fillerCount > 3) confidenceScore -= 1.5;
      if (wpm < 130 || wpm > 160) confidenceScore -= 1;
      confidenceScore = Math.min(10, Math.max(1, confidenceScore));

      const paceAssessment = wpm < 130 ? 'too slow' : wpm > 160 ? 'too fast' : 'ideal';
      let specificFeedbackText = '';
      if (paceAssessment === 'ideal') {
        specificFeedbackText = `Your speaking pace of ${wpm} WPM is within the ideal 130-160 range, indicating calm authority. Word choice reflects logical organization and structured execution.`;
      } else if (paceAssessment === 'too fast') {
        specificFeedbackText = `At ${wpm} WPM, your speaking pace is slightly rushed, which can sometimes diminish message impact. Try adding pauses between critical milestones.`;
      } else {
        specificFeedbackText = `Your speaking pace of ${wpm} WPM is a bit slow. Aim to project more dynamic energy, keeping transitions between STAR elements snappy.`;
      }

      const feedback = `The candidate demonstrated ${starScore >= 7 ? 'solid' : 'partial'} adherence to the STAR method, specifically detailing the context. ${fillerCount > 3 ? 'However, the use of multiple filler words (um, uh, like) slightly affected delivery flow.' : 'The response flowed naturally with good clarity.'}`;

      if (sessionId) {
        updateSession(sessionId, {
          hrScores: {
            clarity_score: clarityScore,
            structure_score: starScore,
            filler_word_count: fillerCount,
            feedback,
            confidence_score: confidenceScore,
            wpm: wpm,
            pace_assessment: paceAssessment,
            specific_feedback: specificFeedbackText
          }
        });
      }
      setIsAnalyzingVoice(false);
    }, 1500);
  };

  const clearTranscript = () => {
    setLocalTranscript('');
    if (sessionId) {
      updateSession(sessionId, { hrTranscript: '', hrScores: null });
    }
  };

  const renderHighlightedTranscript = (text: string) => {
    if (!text) return <span className="text-slate-500 font-sans">{t('room.no_transcript')}</span>;

    const fillerWords = ['um', 'uh', 'like', 'you know'];
    const regex = /\b(um|uh|like|you\s+know)\b/gi;
    const parts = text.split(regex);

    return (
      <span className="text-slate-350 leading-relaxed font-sans text-xs">
        {parts.map((part, idx) => {
          if (fillerWords.includes(part.toLowerCase().replace(/\s+/g, ' '))) {
            return (
              <mark key={idx} className="bg-amber-950/60 text-amber-400 border border-amber-800/40 rounded px-1 font-bold">
                {part}
              </mark>
            );
          }
          return part;
        })}
      </span>
    );
  };

  // Claude AI Question Generation
  const handleGenerateQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenError(null);
    setGeneratedQuestions([]);

    const apiKey = localStorage.getItem('im_claude_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    const resumeText = candidateProfile?.resumeText || (MOCK_MODE ? MOCK_CANDIDATE_RESUME : '');

    const tailorPrompt = tailorToResume && resumeText 
      ? ` Here is the candidate's resume: ${resumeText}. Generate questions that specifically probe the skills and projects mentioned in this resume.`
      : '';

    if (apiKey) {
      try {
        if (user) {
          await checkApiUsage(user.uid);
        }
      } catch (err: any) {
        showToast(err.message || "Daily AI usage limit reached, resets at midnight", "error");
        setIsGenerating(false);
        return;
      }
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-html-user-override': 'true'
          } as any,
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: `Role: ${jobRole}, Difficulty: ${genDifficulty}.${tailorPrompt}`
              }
            ],
            system: "You are a senior technical interviewer. Generate 5 interview questions for the given role and difficulty. Respond ONLY with a valid JSON array, no markdown, no explanation. Each object must have: title (string), description (string, 2-3 sentences), difficulty (Easy/Medium/Hard), category (DSA/System Design/Frontend/HR)."
          })
        });

        if (!response.ok) {
          throw new Error(`Claude API responded with status ${response.status}`);
        }

        const responseData = await response.json();
        
        if (user) {
          await incrementApiUsage(user.uid);
        }

        const jsonText = responseData.content[0].text;
        const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed)) {
          const mapped = parsed.map((item, idx) => ({
            id: `ai_${Date.now()}_${idx}`,
            title: item.title || 'Untitled Question',
            description: item.description || 'No description provided.',
            difficulty: item.difficulty || genDifficulty,
            category: item.category || 'DSA'
          }));
          setGeneratedQuestions(mapped);
          setIsGenerating(false);
          return;
        } else {
          throw new Error("Response is not a valid JSON array");
        }
      } catch (err: any) {
        console.warn("Claude question generation failed, using local fallback:", err);
        Sentry.captureException(err, { tags: { feature: 'question-generation' } });
        setGenError(err.message || "Failed to generate questions. Click Retry to try again.");
        setIsGenerating(false);
        return;
      }
    }

    // Local mock fallback
    setTimeout(() => {
      const detected = detectSkills(resumeText);
      const skill1 = detected[0] || 'React';
      const skill2 = detected[1] || 'Python';
      const skill3 = detected[2] || 'System Design';

      const mockQuestionsList: Question[] = tailorToResume ? [
        {
          id: `ai_${Date.now()}_1`,
          title: `Probing project details: Collaborative IDE using ${skill1}`,
          category: 'Frontend',
          difficulty: genDifficulty,
          description: `You worked on a Collaborative IDE using ${skill1}. Explain the architectural design, trade-offs of using sockets for synchronization, and how you solved local state mismatch bugs.`
        },
        {
          id: `ai_${Date.now()}_2`,
          title: `Optimizing Predictive Models with ${skill2}`,
          category: 'DSA',
          difficulty: genDifficulty,
          description: `In your Predictive Healthcare Analytics project, how did you utilize ${skill2} to optimize dataset parsing performance? Explain the data structures you chose.`
        },
        {
          id: `ai_${Date.now()}_3`,
          title: `Scalable Architecture for ${skill3}`,
          category: 'System Design',
          difficulty: genDifficulty,
          description: `Explain how you would design a high-throughput microservices backend to handle complex client hydration patterns. Discuss data synchronization strategies.`
        },
        {
          id: `ai_${Date.now()}_4`,
          title: `Handling Project Slippages`,
          category: 'HR',
          difficulty: genDifficulty,
          description: `Describe a scenario where a critical deadline was missed in your collaborative coding sandbox. How did you communicate the slippage and adapt the milestones?`
        },
        {
          id: `ai_${Date.now()}_5`,
          title: `State Hydration in ${skill1}`,
          category: 'Frontend',
          difficulty: genDifficulty,
          description: `Explain state hydration details when combining ${skill1} and Socket.io. How do you prevent mismatch hydration issues on page refresh?`
        }
      ] : [
        {
          id: `ai_${Date.now()}_1`,
          title: `Optimizing Database Schema for ${jobRole}`,
          category: 'System Design',
          difficulty: genDifficulty,
          description: `Design a normalized database schema supporting high concurrency operations for a ${jobRole} platform. Outline index partition rules.`
        },
        {
          id: `ai_${Date.now()}_2`,
          title: `Implementing Thread Pool Scheduler`,
          category: 'DSA',
          difficulty: genDifficulty,
          description: `Write an efficient worker thread pool scheduler that minimizes lock contention. Address thread starvation scenarios.`
        },
        {
          id: `ai_${Date.now()}_3`,
          title: `State Hydration in NextJS`,
          category: 'Frontend',
          difficulty: genDifficulty,
          description: `Explain how state hydration works in Server-Side Rendered NextJS applications. Discuss how mismatch warnings occur and how to debug them.`
        },
        {
          id: `ai_${Date.now()}_4`,
          title: `Handling Project Slippages`,
          category: 'HR',
          difficulty: genDifficulty,
          description: `Describe a scenario where a critical deadline was missed. How did you communicate the slippage to management and adapt the milestones?`
        },
        {
          id: `ai_${Date.now()}_5`,
          title: `Caching Complex View Computations`,
          category: 'Frontend',
          difficulty: genDifficulty,
          description: `Implement a memoization cache strategy to hold heavy render frames. Address cache-invalidation rules under memory constraints.`
        }
      ];
      setGeneratedQuestions(mockQuestionsList);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSaveAIToBank = async (q: Question) => {
    try {
      await saveQuestion(q);
      setQuestions(prev => [q, ...prev]);
      setSavedQuestionIds(prev => [...prev, q.id]);
    } catch (e) {
      console.error(e);
      alert("Failed to save question to bank");
    }
  };

  // End Interview trigger
  const handleEndInterview = async () => {
    if (!sessionId || !session) return;

    try {
      // Save current status to completed
      await updateSession(sessionId, { status: 'completed' });

      // Build default feedback structure placeholder in database
      // This gets pulled on the feedback page, which triggers Claude API to analyze this exact code!


      // Pre-save basic values so that feedback page can grab it
      const emptyFeedback = {
        sessionId,
        userId: user?.uid || '',
        reviewerId: session.hostId === user?.uid ? (session.guestId || 'peer') : session.hostId,
        topic: session.topicDetail,
        date: session.date,
        duration: session.duration,
        scores: {
          correctness: 0,
          efficiency: 0,
          communication: 0
        },
        strengths: [],
        improvements: [],
        summary: '',
        createdAt: new Date().toISOString(),
        codeSnippet: code,
        languageUsed: language
      };
      await saveFeedback(emptyFeedback);

      // Redirect to feedback page
      navigate(`/feedback/${sessionId}`);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const activeQuestion = questions.find(q => q.id === session?.activeQuestionId);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f172a] text-slate-100 font-sans">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:text-white focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
      >
        Skip to main content
      </a>
      {/* HEADER SECTION */}
      <header role="banner" className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#1e293b]/70 px-4">
        <div className="flex items-center gap-4">
          <span className="text-base font-bold text-brand cursor-pointer" onClick={() => navigate('/')}>
            InterviewMate
          </span>
          <span className="h-4 w-px bg-slate-800"></span>
          <h2 className="text-xs font-semibold text-slate-300">
            {session?.topicDetail || 'Mock Interview'} — {session?.duration || 45} {t('scheduling_form.min_label', { count: session?.duration || 45 })}
          </h2>
        </div>

        {/* Code/Whiteboard Toggle */}
        <nav aria-label="Room workspace modes" className="flex items-center bg-[#0f172a] rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => {
              setActiveMode('code');
              if (sessionId) updateSession(sessionId, { activeMode: 'code' });
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
              activeMode === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="h-3.5 w-3.5" aria-hidden="true" /> {t('room.code')}
          </button>
          <button
            onClick={() => {
              setActiveMode('whiteboard');
              if (sessionId) updateSession(sessionId, { activeMode: 'whiteboard' });
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
              activeMode === 'whiteboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> {t('room.whiteboard')}
          </button>
        </nav>

        {/* Timer & Question buttons */}
        <div className="flex items-center gap-4">
          {/* Question button (Host/Interviewer only) */}
          {session?.hostId === user?.uid && (
            <button
              onClick={() => setIsQuestionPickerOpen(true)}
              className="flex items-center gap-1 rounded bg-brand hover:bg-brand-hover px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
            >
              <Brain className="h-4 w-4" /> {t('room.pick_question')}
            </button>
          )}

          {/* Chat Icon Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="relative p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={t('room.toggle_chat')}
          >
            <MessageSquare className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Countdown Clock */}
          <div className="flex items-center gap-1.5 rounded bg-red-950/40 border border-red-900/50 px-3 py-1.5 text-xs font-bold text-red-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
          
          {/* End Button */}
          <button
            onClick={handleEndInterview}
            className="flex items-center gap-1.5 rounded bg-red-600 hover:bg-red-700 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <PhoneOff className="h-3.5 w-3.5" /> {t('room.end_interview')}
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE GRID */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 overflow-hidden relative focus:outline-none">
        {/* Chat Sidebar slide-in panel */}
        {isChatOpen && (
          <aside role="complementary" aria-label="Room Chat" className="absolute right-0 top-0 bottom-0 z-30 w-80 border-l border-slate-800 bg-[#0f172a] flex flex-col shadow-2xl transition-all duration-350 ease-in-out">
            {/* Chat Header */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4 bg-[#1e293b]/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-350 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-brand" aria-hidden="true" /> {t('room.room_chat')}
              </span>
              <button
                onClick={() => setIsChatOpen(false)}
                aria-label={t('room.toggle_chat')}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
                  <MessageSquare className="h-8 w-8 text-slate-700 mb-2 opacity-50" />
                  {t('room.no_messages')}
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                     <div
                       key={msg.id}
                       className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                     >
                       <span className="text-[10px] text-slate-500 font-semibold mb-0.5 px-1">
                         {isMe ? 'You' : msg.senderName}
                       </span>
                       <div
                         className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed wrap-break-word ${
                           isMe
                             ? 'bg-teal-700 text-white rounded-tr-none'
                             : 'bg-slate-800 text-slate-200 rounded-tl-none'
                         }`}
                       >
                         {msg.text}
                       </div>
                       <span className="text-[8px] text-slate-600 mt-0.5 px-1">
                         {formatMsgTime(msg.timestamp)}
                       </span>
                     </div>
                   );
                 })
               )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChatMessage} className="border-t border-slate-800 p-3 bg-[#0b0f19] flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t('room.type_message')}
                className="flex-1 rounded-lg border border-slate-800 bg-[#0f172a] px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand hover:bg-brand-hover text-white px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                {t('room.send')}
              </button>
            </form>
          </aside>
        )}

        {/* LEFT VIDEO PANEL (60%) */}
        <div className="flex w-[60%] flex-col bg-[#0b0f19] p-4 relative justify-between">
          <div className="grid flex-1 grid-rows-2 gap-4"> {/* Tile 1: Peer / Interviewer */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden flex items-center justify-center">
              {AGORA_APP_ID && remoteUsers.length > 0 ? (
                // Real Agora Video Container
                <div id={`remote-stream-${remoteUsers[0].uid}`} className="absolute inset-0 h-full w-full object-cover"></div>
              ) : (
                // Fallback Mock Placeholder Stream
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-xl font-bold text-slate-300">
                      {session?.hostId === user?.uid ? (session?.guestName?.[0] || 'G') : (session?.hostName?.[0] || 'H')}
                    </span>
                  </div>
                  <p className="text-xs">{t('room.waiting_peer_stream')}</p>
                </div>
              )}
              {/* Overlay Metadata */}
              <div className="absolute left-4 bottom-4 rounded bg-slate-950/80 px-2.5 py-1 text-xs font-medium border border-slate-800">
                {session?.hostId === user?.uid 
                  ? `${session?.guestName || 'Guest'} (Candidate)` 
                  : `${session?.hostName || 'Interviewer'} (Interviewer)`}
              </div>
            </div>

            {/* Tile 2: Local User / Interviewee */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden flex items-center justify-center">
              {AGORA_APP_ID ? (
                // Real Agora Video Container
                <div id="local-stream-container" className="absolute inset-0 h-full w-full object-cover"></div>
              ) : cameraStream ? (
                // Local MediaStream HTML Video fallback
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
                />
              ) : (
                // Fallback Avatar
                <div className="flex flex-col items-center gap-3 text-slate-550">
                  <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-xl font-bold text-slate-300">
                      {profile?.displayName?.[0] || user?.displayName?.[0] || 'Y'}
                    </span>
                  </div>
                  <p className="text-xs">{t('room.camera_off')}</p>
                </div>
              )}
              {/* Overlay Metadata */}
              <div className="absolute left-4 bottom-4 rounded bg-slate-950/80 px-2.5 py-1 text-xs font-medium border border-slate-800">
                {profile?.displayName || user?.displayName || 'You'} (You)
              </div>
            </div>
          </div>

          {/* Controls Footer Overlay for Video panel */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={toggleMute}
              className={`rounded-full p-3 transition-all cursor-pointer ${
                micActive ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-950 border border-red-900 text-red-400'
              }`}
            >
              {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button
              onClick={toggleCamera}
              className={`rounded-full p-3 transition-all cursor-pointer ${
                cameraActive ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-950 border border-red-900 text-red-400'
              }`}
            >
              {cameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
            <button className="rounded-full p-3 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer" title={t('room.share_screen')}>
              <Monitor className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* RIGHT CODE PANEL (40%) */}
        <div className="flex w-[40%] flex-col border-l border-slate-800 bg-[#0b0f19]">
          {/* If there is an active question, display it in a shared panel above editor */}
          {activeQuestion ? (
            <div className="bg-[#1e293b]/40 border-b border-slate-800 p-4 max-h-[220px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <Code className="h-4 w-4 text-brand" aria-hidden="true" /> {activeQuestion.title}
                </h3>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  activeQuestion.difficulty === 'Easy' ? 'bg-green-950/50 text-green-400' :
                  activeQuestion.difficulty === 'Medium' ? 'bg-amber-950/50 text-amber-400' : 'bg-red-950/50 text-red-400'
                }`}>
                  {activeQuestion.difficulty === 'Easy' && <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" aria-hidden="true"></span>}
                  {activeQuestion.difficulty === 'Medium' && (
                    <span 
                      className="h-1.5 w-1.5 bg-amber-400 shrink-0" 
                      style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                      aria-hidden="true"
                    ></span>
                  )}
                  {activeQuestion.difficulty === 'Hard' && <span className="h-1.5 w-1.5 bg-red-400 shrink-0" aria-hidden="true"></span>}
                  <span>{activeQuestion.difficulty}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap">
                {activeQuestion.description}
              </p>
            </div>
          ) : (
            <div className="bg-[#1e293b]/20 border-b border-slate-800 px-4 py-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500 font-medium">{t('room.waiting_question_pick')}</span>
            </div>
          )}

          {activeMode === 'code' ? (
            activeQuestion?.category === 'HR' ? (
              <div className="flex flex-1 flex-col bg-[#0b0f19] p-6 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-brand" />
                    <h3 className="text-sm font-bold text-white">{t('room.hr_console')}</h3>
                  </div>
                  {((session?.hrTranscript) || localTranscript) && (
                    <button
                      onClick={clearTranscript}
                      className="text-xs text-slate-505 hover:text-slate-300 flex items-center gap-1 cursor-pointer focus:outline-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t('room.clear_transcript')}
                    </button>
                  )}
                </div>

                {/* Microphone Record Card */}
                <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-md mb-6 shrink-0">
                  <div className="mb-4">
                    {isRecording ? (
                      <button
                        onClick={stopRecording}
                        className="relative flex items-center justify-center h-20 w-20 rounded-full bg-red-600 text-white cursor-pointer shadow-lg hover:bg-red-700 transition-all animate-pulse"
                      >
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
                        <MicOff className="h-8 w-8 relative z-10" />
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="flex items-center justify-center h-20 w-20 rounded-full bg-brand hover:bg-brand-hover text-white cursor-pointer shadow-lg transition-all"
                      >
                        <Mic className="h-8 w-8" />
                      </button>
                    )}
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-200 mb-1">
                    {isRecording ? t('room.recording_answer') : t('room.ready_record')}
                  </h4>
                  <p className="text-[11px] text-slate-404 max-w-xs leading-normal">
                    {isRecording 
                      ? t('room.recording_active_desc')
                      : t('room.recording_ready_desc')}
                  </p>
                </div>

                {/* Live Transcript Panel */}
                <div className="flex flex-col flex-1 min-h-[160px] mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {t('room.live_transcript')}
                    </span>
                    {isRecording && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        {t('room.live_dictation_active')}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 bg-slate-950/50 border border-slate-850 rounded-xl p-4 overflow-y-auto max-h-[200px]">
                    {renderHighlightedTranscript(session?.hrTranscript || localTranscript)}
                  </div>
                </div>

                {/* Scorecard Assessment Details */}
                {isAnalyzingVoice && (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-slate-800 rounded-xl animate-pulse mb-6">
                    <RotateCw className="h-7 w-7 text-brand animate-spin mb-2" />
                    <span className="text-xs text-slate-355">{t('room.evaluating_star')}</span>
                  </div>
                )}

                {session?.hrScores && !isAnalyzingVoice && (
                  <div className="bg-[#131b2e] border border-slate-850 rounded-xl p-5 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Sparkles className="h-4 w-4" /> {t('room.star_scorecard')}
                    </h4>
                    
                    <div className="grid grid-cols-4 gap-2.5">
                      {/* Clarity Card */}
                      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-2.5 text-center">
                        <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider block mb-1">
                          {t('room.clarity')}
                        </span>
                        <span className="text-base font-extrabold text-emerald-400">
                          {session.hrScores.clarity_score}/10
                        </span>
                      </div>
                      
                      {/* STAR Structure Card */}
                      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-2.5 text-center">
                        <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider block mb-1">
                          {t('room.star_structure')}
                        </span>
                        <span className="text-base font-extrabold text-indigo-400">
                          {session.hrScores.structure_score}/10
                        </span>
                      </div>

                      {/* Confidence Score Card */}
                      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-2.5 text-center">
                        <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider block mb-1">
                          {t('room.confidence')}
                        </span>
                        <span className="text-base font-extrabold text-violet-400">
                          {session.hrScores.confidence_score !== undefined ? `${session.hrScores.confidence_score}/10` : 'N/A'}
                        </span>
                      </div>

                      {/* Filler Words Card */}
                      <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-2.5 text-center">
                        <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider block mb-1">
                          {t('room.filler_words')}
                        </span>
                        <span className={`text-base font-extrabold ${
                          session.hrScores.filler_word_count > 3 ? 'text-amber-400' : 'text-slate-350'
                        }`}>
                          {session.hrScores.filler_word_count}
                        </span>
                      </div>
                    </div>

                    {session.hrScores.wpm !== undefined && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 border-t border-slate-800/60 pt-3.5">
                        {/* WPM Speedometer Card */}
                        <div className="md:col-span-1 bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] text-slate-505 font-bold uppercase tracking-wider block mb-1.5">
                            {t('room.speaking_pace')}
                          </span>
                          
                          <div className="relative w-28 h-14 flex items-center justify-center overflow-hidden">
                            <svg className="w-28 h-20 overflow-visible" viewBox="0 0 100 50">
                              <path
                                d="M 10 50 A 40 40 0 0 1 90 50"
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="8"
                              />
                              <path
                                d="M 42 13.5 A 40 40 0 0 1 73 22"
                                fill="none"
                                stroke="#2dd4bf"
                                strokeWidth="8"
                              />
                              <line
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="15"
                                stroke="#6366f1"
                                strokeWidth="3"
                                strokeLinecap="round"
                                transform={`rotate(${(() => {
                                  const wpmVal = session.hrScores.wpm || 0;
                                  const minW = 60;
                                  const maxW = 220;
                                  const percent = Math.min(100, Math.max(0, ((wpmVal - minW) / (maxW - minW)) * 100));
                                  return (percent * 1.8) - 90;
                                })()} 50 50)`}
                                className="transition-transform duration-500 ease-out"
                              />
                              <circle cx="50" cy="50" r="5" fill="#6366f1" />
                            </svg>
                            
                            <div className="absolute bottom-0 text-center">
                              <span className="text-sm font-extrabold text-slate-100">{session.hrScores.wpm}</span>
                              <span className={`text-[8px] font-bold block uppercase tracking-wider ${
                                session.hrScores.pace_assessment === 'ideal' ? 'text-teal-400' : 'text-amber-500'
                              }`}>
                                {session.hrScores.pace_assessment}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Pace Feedback summary card */}
                        <div className="md:col-span-2 bg-[#0f172a] border border-slate-800 rounded-lg p-3 flex flex-col justify-center text-left">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                            {t('room.pacing_feedback')}
                          </span>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                            {session.hrScores.specific_feedback || t('room.pacing_evaluated')}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-[#0f172a]/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">{t('room.feedback_summary')}</span>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {session.hrScores.feedback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Editor Header controls */}
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-[#131b2e] px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{t('room.solution_tab')}</span>
                    <select
                      value={language}
                      onChange={handleLanguageChange}
                      className="rounded border border-slate-800 bg-[#0f172a] px-2 py-1 text-xs font-semibold text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>

                  <button
                    onClick={runCode}
                    disabled={isRunning || (lastOutput?.status === 'idle')}
                    className="flex items-center gap-1.5 rounded bg-brand hover:bg-brand-hover px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-white"
                  >
                    {isRunning || (lastOutput?.status === 'idle') ? (
                      <>
                        <RotateCw className="h-3 w-3 animate-spin" /> {t('room.running')}
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" /> {t('room.run_code')}
                      </>
                    )}
                  </button>
                </div>

                {/* Monaco Editor Container */}
                <div className="flex-1 min-h-[300px]">
                  <React.Suspense fallback={
                    <div className="w-full h-full min-h-[300px] bg-[#1e1e1e] flex flex-col items-center justify-center text-slate-400 gap-3 font-mono text-sm border border-slate-800 rounded-md">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                      <span>Loading code editor...</span>
                    </div>
                  }>
                    <Editor
                      height="100%"
                      language={language === 'cpp' ? 'cpp' : language}
                      theme="vs-dark"
                      value={code}
                      onChange={handleEditorChange}
                      onMount={handleEditorDidMount}
                      options={{
                        fontSize: 13,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        roundedSelection: true,
                        scrollBeyondLastLine: false,
                        readOnly: false,
                        cursorBlinking: 'smooth',
                        fontFamily: 'Consolas, Monaco, monospace'
                      }}
                    />
                  </React.Suspense>
                </div>

                {/* Synced Terminal Console */}
                <div className={`${isTerminalCollapsed ? 'h-9' : 'h-48'} border-t border-slate-800 bg-[#090d16] flex flex-col transition-all duration-200`}>
                  <div className="flex h-9 items-center justify-between border-b border-slate-800 bg-[#101726] px-3 shrink-0">
                    <button 
                      onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                      className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 focus:outline-none hover:text-slate-200 cursor-pointer"
                    >
                      <Terminal className="h-3 w-3" /> {t('room.console_output')} {isTerminalCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    
                    {!isTerminalCollapsed && (
                      <button 
                        onClick={() => {
                          if (sessionId) {
                            updateSession(sessionId, { lastOutput: null });
                          } else {
                            setLastOutput(null);
                          }
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 focus:outline-none cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> {t('room.clear')}
                      </button>
                    )}
                  </div>

                  {!isTerminalCollapsed && (
                    <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap">
                      {!lastOutput ? (
                        <span className="text-slate-600">{t('room.console_ready')}</span>
                      ) : lastOutput.status === 'idle' ? (
                        <span className="text-slate-400 animate-pulse flex items-center gap-1.5">
                          <RotateCw className="h-3.5 w-3.5 animate-spin" /> {t('room.console_running')}
                        </span>
                      ) : lastOutput.status === 'timeout' ? (
                        <span className="text-red-500 font-bold block">
                          {t('room.console_timeout')}
                        </span>
                      ) : lastOutput.status === 'compile_error' ? (
                        <span className="text-amber-500 block">
                          {t('room.console_compilation_error')}
                          {"\n"}{lastOutput.compileOutput}
                        </span>
                      ) : lastOutput.status === 'error' ? (
                        <span className="text-red-500 block">
                          {t('room.console_execution_error')}
                          {"\n"}{lastOutput.stderr}
                        </span>
                      ) : (
                        <span className="text-emerald-400 block">
                          {lastOutput.stdout}
                        </span>
                      )}
                    </pre>
                  )}
                </div>
              </>
            )
          ) : (
            <aside role="complementary" aria-label="Whiteboard Canvas" className="flex-1 relative overflow-hidden bg-slate-900 border-t border-slate-800 flex flex-col justify-stretch">
              <React.Suspense fallback={
                <div className="w-full h-full min-h-[400px] bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-3 font-sans text-sm">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
                  <span>Loading interactive whiteboard...</span>
                </div>
              }>
                <Excalidraw
                  excalidrawAPI={(api) => { excalidrawRef.current = api; }}
                  onChange={handleWhiteboardChange}
                  theme="dark"
                />
              </React.Suspense>
            </aside>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-800 bg-[#0e1626] px-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{t('room.both_users_connected')}</span>
          <span className="h-3 w-px bg-slate-800"></span>
          <span>{t('room.latency')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{t('room.shortcuts')}</span>
          <span>{t('room.support')}</span>
        </div>
      </footer>

      {/* QUESTION PICKER SIDE PANEL DRAWER */}
      {isQuestionPickerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
            setIsQuestionPickerOpen(false);
            setIsCustomQuestionOpen(false);
          }}></div>
          
          <div className="relative w-full max-w-md h-full bg-[#111827] border-l border-slate-800 p-6 flex flex-col z-10">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-brand" /> {t('room.question_bank')}
                </h3>
                <p className="text-[11px] text-slate-400">{t('room.search_filter_push')}</p>
              </div>
              <button 
                onClick={() => {
                  setIsQuestionPickerOpen(false);
                  setIsCustomQuestionOpen(false);
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Custom Question form or List container */}
            {isCustomQuestionOpen ? (
              <form onSubmit={handleCreateCustomQuestion} className="space-y-4 text-left flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <h4 className="text-xs font-bold text-brand uppercase tracking-wider">{t('room.create_custom_question')}</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room.title')}</label>
                    <input
                      type="text"
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={t('room.title_placeholder')}
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room.description')}</label>
                    <textarea
                      rows={5}
                      required
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      placeholder={t('room.desc_placeholder')}
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none resize-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room.category')}</label>
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value as any)}
                        className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="DSA">DSA</option>
                        <option value="System Design">System Design</option>
                        <option value="Frontend">Frontend</option>
                        <option value="HR">HR</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room.difficulty')}</label>
                      <select
                        value={customDifficulty}
                        onChange={(e) => setCustomDifficulty(e.target.value as any)}
                        className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCustomQuestionOpen(false)}
                    className="flex-1 rounded-lg border border-slate-800 py-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    {t('room.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold"
                  >
                    {t('room.add_question')}
                  </button>
                </div>
              </form>
            ) : isAIQuestionOpen ? (
              <div className="flex-1 flex flex-col overflow-hidden text-left">
                <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" /> {t('room.ai_question_generator')}
                </h4>

                <form onSubmit={handleGenerateQuestions} className="space-y-4 shrink-0 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room.job_role')}</label>
                    <input
                      type="text"
                      required
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      placeholder={t('room.job_role_placeholder')}
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('room.difficulty')}</label>
                    <div className="flex gap-2">
                      {(['Easy', 'Medium', 'Hard'] as const).map((diff, idx, arr) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setGenDifficulty(diff)}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              const nextIdx = (idx + 1) % arr.length;
                              setGenDifficulty(arr[nextIdx]);
                              const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                              if (buttons && buttons[nextIdx]) {
                                (buttons[nextIdx] as HTMLButtonElement).focus();
                              }
                            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                              e.preventDefault();
                              const prevIdx = (idx - 1 + arr.length) % arr.length;
                              setGenDifficulty(arr[prevIdx]);
                              const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                              if (buttons && buttons[prevIdx]) {
                                (buttons[prevIdx] as HTMLButtonElement).focus();
                              }
                            }
                          }}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus:outline-none ${
                            genDifficulty === diff
                              ? 'bg-brand/10 border-brand text-brand'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tailor to Resume Checkbox */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="tailorToResume"
                        checked={tailorToResume}
                        onChange={(e) => setTailorToResume(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-800 bg-[#0f172a] text-brand focus:ring-brand focus:ring-opacity-25 cursor-pointer"
                      />
                      <label htmlFor="tailorToResume" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                        {t('room.tailor_to_resume')}
                      </label>
                    </div>
                    {tailorToResume && !candidateProfile?.resumeText && !MOCK_MODE && (
                      <p className="text-[10px] text-amber-500 font-medium leading-normal">
                        {t('room.no_resume_warning')}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating || !jobRole.trim()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" /> {t('room.generating')}
                      </>
                    ) : (
                      <>
                        {t('room.generate_questions')}
                      </>
                    )}
                  </button>
                </form>

                {/* Generated Questions List or Loading */}
                <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                  {isGenerating && (
                    <div className="text-center py-12 text-slate-500">
                      <RotateCw className="h-8 w-8 text-brand animate-spin mx-auto mb-2" />
                      <p className="text-xs">{t('room.claude_crafting')}</p>
                    </div>
                  )}

                  {genError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-center space-y-3">
                      <p className="text-xs text-red-400 leading-relaxed font-semibold">{genError}</p>
                      <button
                        onClick={handleGenerateQuestions}
                        className="rounded bg-red-650 hover:bg-red-700 text-white px-4 py-1.5 text-xs font-bold cursor-pointer mx-auto"
                      >
                        {t('room.retry')}
                      </button>
                    </div>
                  )}

                  {!isGenerating && !genError && generatedQuestions.length > 0 && (
                    <div className="space-y-4 text-left">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('room.generated_questions')}</h5>
                      {tailorToResume && (
                        <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl mb-3 text-left">
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block mb-1.5">
                            {t('room.detected_skills')}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {detectSkills(candidateProfile?.resumeText || MOCK_CANDIDATE_RESUME).map((skill) => (
                              <span key={skill} className="rounded bg-indigo-950/80 border border-indigo-850/50 px-2 py-0.5 text-[9px] font-semibold text-indigo-300">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {generatedQuestions.map((q) => {
                        const isSaved = savedQuestionIds.includes(q.id);
                        return (
                          <div key={q.id} className="rounded-xl border border-slate-850 bg-slate-900/40 p-4 flex flex-col justify-between hover:border-slate-800">
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-400 border border-indigo-900/30">
                                  {q.category}
                                </span>
                                <span className={`text-[10px] font-bold ${
                                  q.difficulty === 'Easy' ? 'text-emerald-400' :
                                  q.difficulty === 'Medium' ? 'text-amber-400' : 'text-rose-500'
                                }`}>
                                  {q.difficulty}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-100 mb-1">{q.title}</h4>
                              <p className="text-[10px] text-slate-400 leading-relaxed mb-3 font-mono whitespace-pre-wrap">{q.description}</p>
                            </div>

                            <button
                              onClick={() => handleSaveAIToBank(q)}
                              disabled={isSaved}
                              className={`w-full rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                isSaved
                                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              }`}
                            >
                              {isSaved ? (
                                <>
                                  <Save className="h-3.5 w-3.5" /> {t('room.saved_to_bank')}
                                </>
                              ) : (
                                <>
                                  {t('room.save_to_bank')}
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Back button */}
                <div className="border-t border-slate-800 pt-4 shrink-0">
                  <button
                    onClick={() => {
                      setIsAIQuestionOpen(false);
                      setGeneratedQuestions([]);
                      setGenError(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-300 py-3 text-xs font-bold transition-all cursor-pointer"
                  >
                    {t('room.back_to_bank')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden text-left">
                {/* AI Question generator action button */}
                <button
                  onClick={() => setIsAIQuestionOpen(true)}
                  className="mb-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-teal-500 to-indigo-600 hover:from-teal-650 hover:to-indigo-750 text-white py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> {t('room.generate_questions')}
                </button>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder={t('room.search_questions')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] py-2.5 pl-9 pr-3 text-xs text-slate-300 placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                {/* Categories Pills */}
                <div className="flex gap-2.5 overflow-x-auto pb-3 mb-4 scrollbar-none border-b border-slate-800 shrink-0">
                  {(['All', 'DSA', 'System Design', 'Frontend', 'HR'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-brand/10 border-brand text-brand'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Questions List */}
                <div className="grow overflow-y-auto space-y-3.5 pr-1 mb-4">
                  {questions
                    .filter((q) => {
                      const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            q.description.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
                      return matchesSearch && matchesCategory;
                    })
                    .map((q) => {
                      const avgTime = q.difficulty === 'Easy' ? '30m' : q.difficulty === 'Medium' ? '45m' : '60m';
                      const isActive = session?.activeQuestionId === q.id;

                      return (
                        <div
                          key={q.id}
                          className={`rounded-xl border p-4.5 transition-all text-left flex flex-col justify-between ${
                            isActive
                              ? 'bg-brand/5 border-brand ring-1 ring-brand'
                              : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              {/* Category Badge */}
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                q.category === 'DSA' ? 'bg-teal-950/40 text-teal-400 border border-teal-900/30' :
                                q.category === 'System Design' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30' :
                                q.category === 'Frontend' ? 'bg-orange-950/40 text-orange-400 border border-orange-900/30' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {q.category}
                              </span>

                              {/* Difficulty Indicator with Icon */}
                              <span className="flex items-center gap-1.5 text-[10px] font-bold">
                                {q.difficulty === 'Easy' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>}
                                {q.difficulty === 'Medium' && (
                                  <span 
                                    className="h-1.5 w-1.5 bg-amber-500 shrink-0" 
                                    style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
                                  ></span>
                                )}
                                {q.difficulty === 'Hard' && <span className="h-1.5 w-1.5 bg-rose-600 shrink-0" title="Hard (Square indicator)"></span>}
                                <span className={`${
                                  q.difficulty === 'Easy' ? 'text-emerald-400' :
                                  q.difficulty === 'Medium' ? 'text-amber-400' : 'text-rose-500'
                                }`}>
                                  {q.difficulty}
                                </span>
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-100 mb-1">{q.title}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-3 font-mono whitespace-pre-wrap">
                              {q.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-800/40">
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {t('room.avg_time', { time: avgTime })}
                            </span>
                            
                            {/* Sync Status Badge if selected */}
                            {isActive && (
                              <span className="inline-flex items-center gap-1 rounded bg-brand/15 border border-brand/30 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                                <span className="h-1 w-1 rounded-full bg-brand animate-pulse"></span>
                                Connected
                              </span>
                            )}
                          </div>

                          {/* Trigger push selection */}
                          <button
                            onClick={() => handleQuestionSelect(q.id)}
                            className={`mt-3.5 w-full rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-brand text-white border border-brand shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            }`}
                          >
                            {isActive ? t('room.question_active') : t('room.use_this_question')}
                          </button>
                        </div>
                      );
                    })}
                </div>

                {/* Create Custom Button Footer */}
                <div className="border-t border-slate-800 pt-4 shrink-0">
                  <button
                    onClick={() => setIsCustomQuestionOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 py-3 text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    {t('room.create_custom_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
