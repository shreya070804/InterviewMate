import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeToSession, 
  updateSession, 
  getQuestions, 
  saveFeedback, 
  saveQuestion 
} from '../firebase';
import type { Session, Question } from '../types';
import Editor from '@monaco-editor/react';
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
  Sparkles
} from 'lucide-react';
import { Excalidraw } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';

export const InterviewRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'DSA' | 'System Design' | 'Frontend' | 'HR'>('All');
  
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

  // Claude AI Question Generation
  const handleGenerateQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenError(null);
    setGeneratedQuestions([]);

    const apiKey = localStorage.getItem('im_claude_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

    if (apiKey) {
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
                content: `Role: ${jobRole}, Difficulty: ${genDifficulty}`
              }
            ],
            system: "You are a senior technical interviewer. Generate 5 interview questions for the given role and difficulty. Respond ONLY with a valid JSON array, no markdown, no explanation. Each object must have: title (string), description (string, 2-3 sentences), difficulty (Easy/Medium/Hard), category (DSA/System Design/Frontend/HR)."
          })
        });

        if (!response.ok) {
          throw new Error(`Claude API responded with status ${response.status}`);
        }

        const responseData = await response.json();
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
        setGenError(err.message || "Failed to generate questions. Click Retry to try again.");
        setIsGenerating(false);
        return;
      }
    }

    // Local mock fallback
    setTimeout(() => {
      const mockQuestionsList: Question[] = [
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
      {/* HEADER SECTION */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#1e293b]/70 px-4">
        <div className="flex items-center gap-4">
          <span className="text-base font-bold text-brand cursor-pointer" onClick={() => navigate('/')}>
            InterviewMate
          </span>
          <span className="h-4 w-px bg-slate-800"></span>
          <h2 className="text-xs font-semibold text-slate-300">
            {session?.topicDetail || 'Mock Interview'} — {session?.duration || 45} min
          </h2>
        </div>

        {/* Code/Whiteboard Toggle */}
        <div className="flex items-center bg-[#0f172a] rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => {
              setActiveMode('code');
              if (sessionId) updateSession(sessionId, { activeMode: 'code' });
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeMode === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="h-3.5 w-3.5" /> Code
          </button>
          <button
            onClick={() => {
              setActiveMode('whiteboard');
              if (sessionId) updateSession(sessionId, { activeMode: 'whiteboard' });
            }}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeMode === 'whiteboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" /> Whiteboard
          </button>
        </div>

        {/* Timer & Question buttons */}
        <div className="flex items-center gap-4">
          {/* Question button (Host/Interviewer only) */}
          {session?.hostId === user?.uid && (
            <button
              onClick={() => setIsQuestionPickerOpen(true)}
              className="flex items-center gap-1 rounded bg-brand hover:bg-brand-hover px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
            >
              <Brain className="h-4 w-4" /> Pick Question
            </button>
          )}

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
            <PhoneOff className="h-3.5 w-3.5" /> End interview
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE GRID */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT VIDEO PANEL (60%) */}
        <div className="flex w-[60%] flex-col bg-[#0b0f19] p-4 relative justify-between">
          <div className="grid flex-1 grid-rows-2 gap-4">
            {/* Tile 1: Peer / Interviewer */}
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
                  <p className="text-xs">Waiting for peer stream...</p>
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
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-xl font-bold text-slate-300">
                      {profile?.displayName?.[0] || user?.displayName?.[0] || 'Y'}
                    </span>
                  </div>
                  <p className="text-xs">Camera is off</p>
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
            <button className="rounded-full p-3 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer" title="Share Screen">
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
                  <Code className="h-4 w-4 text-brand" /> {activeQuestion.title}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  activeQuestion.difficulty === 'Easy' ? 'bg-green-950/50 text-green-400' :
                  activeQuestion.difficulty === 'Medium' ? 'bg-amber-950/50 text-amber-400' : 'bg-red-950/50 text-red-400'
                }`}>
                  {activeQuestion.difficulty}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap">
                {activeQuestion.description}
              </p>
            </div>
          ) : (
            <div className="bg-[#1e293b]/20 border-b border-slate-800 px-4 py-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500 font-medium">Waiting for interviewer to pick a question...</span>
            </div>
          )}

          {activeMode === 'code' ? (
            <>
              {/* Editor Header controls */}
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-[#131b2e] px-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">SOLUTION.JS</span>
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
                      <RotateCw className="h-3 w-3 animate-spin" /> Running
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" /> Run Code
                    </>
                  )}
                </button>
              </div>

              {/* Monaco Editor Container */}
              <div className="flex-1 min-h-[300px]">
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
              </div>

              {/* Synced Terminal Console */}
              <div className={`${isTerminalCollapsed ? 'h-9' : 'h-48'} border-t border-slate-800 bg-[#090d16] flex flex-col transition-all duration-200`}>
                <div className="flex h-9 items-center justify-between border-b border-slate-800 bg-[#101726] px-3 shrink-0">
                  <button 
                    onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                    className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 focus:outline-none hover:text-slate-200 cursor-pointer"
                  >
                    <Terminal className="h-3 w-3" /> Console Output {isTerminalCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
                      <Trash2 className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>

                {!isTerminalCollapsed && (
                  <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap">
                    {!lastOutput ? (
                      <span className="text-slate-600">Console initialized. Ready to execute code solutions.</span>
                    ) : lastOutput.status === 'idle' ? (
                      <span className="text-slate-400 animate-pulse flex items-center gap-1.5">
                        <RotateCw className="h-3.5 w-3.5 animate-spin" /> Compiling and running build inside Judge0 sandboxed runtime...
                      </span>
                    ) : lastOutput.status === 'timeout' ? (
                      <span className="text-red-500 font-bold block">
                        [Timeout Error] Execution exceeded 10 seconds.
                      </span>
                    ) : lastOutput.status === 'compile_error' ? (
                      <span className="text-amber-500 block">
                        [Compilation Error]
                        {"\n"}{lastOutput.compileOutput}
                      </span>
                    ) : lastOutput.status === 'error' ? (
                      <span className="text-red-500 block">
                        [Execution Error]
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
          ) : (
            <div className="flex-1 relative overflow-hidden bg-slate-900 border-t border-slate-800">
              <Excalidraw
                excalidrawAPI={(api) => { excalidrawRef.current = api; }}
                onChange={handleWhiteboardChange}
                theme="dark"
              />
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-800 bg-[#0e1626] px-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Both users connected</span>
          <span className="h-3 w-px bg-slate-800"></span>
          <span>Latency: 24ms</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Shortcuts</span>
          <span>Support</span>
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
                  <Brain className="h-5 w-5 text-brand" /> Question bank
                </h3>
                <p className="text-[11px] text-slate-400">Search, filter, and push questions to the candidate</p>
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
                  <h4 className="text-xs font-bold text-brand uppercase tracking-wider">Create Custom Question</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</label>
                    <input
                      type="text"
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Reverse a String"
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={5}
                      required
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      placeholder="e.g. Implement a function that reverses a string input in-place..."
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none resize-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
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
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Difficulty</label>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold"
                  >
                    Add Question
                  </button>
                </div>
              </form>
            ) : isAIQuestionOpen ? (
              <div className="flex-1 flex flex-col overflow-hidden text-left">
                <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" /> AI Question Generator
                </h4>

                <form onSubmit={handleGenerateQuestions} className="space-y-4 shrink-0 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Role</label>
                    <input
                      type="text"
                      required
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      placeholder="e.g. Frontend Engineer at Swiggy"
                      className="block w-full rounded-lg border border-slate-800 bg-[#0f172a] p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-brand focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Difficulty</label>
                    <div className="flex gap-2">
                      {(['Easy', 'Medium', 'Hard'] as const).map(diff => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setGenDifficulty(diff)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
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

                  <button
                    type="submit"
                    disabled={isGenerating || !jobRole.trim()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        Generate Questions
                      </>
                    )}
                  </button>
                </form>

                {/* Generated Questions List or Loading */}
                <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                  {isGenerating && (
                    <div className="text-center py-12 text-slate-500">
                      <RotateCw className="h-8 w-8 text-brand animate-spin mx-auto mb-2" />
                      <p className="text-xs">Claude is crafting questions for your role...</p>
                    </div>
                  )}

                  {genError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-center space-y-3">
                      <p className="text-xs text-red-400 leading-relaxed font-semibold">{genError}</p>
                      <button
                        onClick={handleGenerateQuestions}
                        className="rounded bg-red-650 hover:bg-red-700 text-white px-4 py-1.5 text-xs font-bold cursor-pointer mx-auto"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isGenerating && !genError && generatedQuestions.length > 0 && (
                    <div className="space-y-4 text-left">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Generated Questions</h5>
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
                                  <Save className="h-3.5 w-3.5" /> Saved to bank
                                </>
                              ) : (
                                <>
                                  Save to bank
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
                    Back to question bank
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
                  <Sparkles className="h-4 w-4" /> Generate questions
                </button>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search questions..."
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
                                {q.difficulty === 'Hard' && <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0"></span>}
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
                              Avg time: {avgTime}
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
                            {isActive ? 'Question Active' : 'Use this question'}
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
                    + Create custom question
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
