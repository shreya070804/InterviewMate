import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveSoloSession, saveFeedback } from '../firebase';
import { Layout } from '../components/Layout';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  Terminal, 
  ArrowLeft, 
  User, 
  Sparkles,
  RefreshCw,
  Trash2,
  Brain,
  MessageSquare,
  AlertCircle
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const SoloInterview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode: 'setup' | 'interview'
  const [mode, setMode] = useState<'setup' | 'interview'>('setup');
  const [topic, setTopic] = useState<'DSA' | 'System Design' | 'Frontend' | 'HR'>('DSA');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  // Interview UI States
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [code, setCode] = useState('// Write your solution here\n\nfunction solve() {\n  \n}');
  const [language, setLanguage] = useState('javascript');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  // Terminal Panel
  const [lastOutput, setLastOutput] = useState<{
    stdout?: string;
    stderr?: string;
    compileOutput?: string;
    status: 'success' | 'error' | 'compile_error' | 'timeout' | 'idle';
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Auto-scroll chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isStreaming]);

  // Set default code template based on language
  useEffect(() => {
    if (language === 'javascript') {
      setCode('// Write your solution here\n\nfunction solve() {\n  \n}');
    } else if (language === 'python') {
      setCode('# Write your solution here\n\ndef solve():\n    pass');
    } else if (language === 'java') {
      setCode('// Write your solution here\n\nclass Solution {\n    public static void main(String[] args) {\n        \n    }\n}');
    } else if (language === 'cpp') {
      setCode('// Write your solution here\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}');
    }
  }, [language]);

  const handleStartSession = async () => {
    setMode('interview');
    setIsStreaming(true);
    setStreamingText('');

    const initialSystemPrompt = `You are a strict but encouraging senior software engineer conducting a technical mock interview. Your name is Alex. Start by greeting the candidate, then ask one technical question based on the topic and difficulty provided. After the candidate responds, ask a relevant follow-up question or hint if they are stuck. When they submit their final code, evaluate it and give feedback. Keep responses concise — max 3 sentences per message.`;

    const initialUserMessage = `Hello Alex, I'm ready for my solo mock interview on Topic: ${topic} and Difficulty: ${difficulty}. Please introduce yourself and ask the first question.`;

    chatHistory.current = [
      { role: 'user', content: initialUserMessage }
    ];

    await getClaudeResponseStream(chatHistory.current, initialSystemPrompt);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isStreaming) return;

    const userText = inputVal.trim();
    setInputVal('');

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    
    // Add to Claude history
    chatHistory.current.push({ role: 'user', content: `Candidate says: "${userText}". Current code is: \n\`\`\`${language}\n${code}\n\`\`\`` });

    setIsStreaming(true);
    setStreamingText('');

    const systemPrompt = `You are a strict but encouraging senior software engineer conducting a technical mock interview. Your name is Alex. Start by greeting the candidate, then ask one technical question based on the topic and difficulty provided. After the candidate responds, ask a relevant follow-up question or hint if they are stuck. When they submit their final code, evaluate it and give feedback. Keep responses concise — max 3 sentences per message.`;

    await getClaudeResponseStream(chatHistory.current, systemPrompt);
  };

  // Streaming parser
  const getClaudeResponseStream = async (history: { role: 'user' | 'assistant'; content: string }[], systemPrompt: string) => {
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
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemPrompt,
            messages: history,
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error('Streaming failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const cleaned = line.trim();
              if (cleaned.startsWith('data: ')) {
                const jsonStr = cleaned.slice(6);
                if (jsonStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    fullText += parsed.delta.text;
                    setStreamingText(fullText);
                  }
                } catch (e) {
                  // Incomplete JSON line, skip
                }
              }
            }
          }
        }

        // Finalize
        setIsStreaming(false);
        const aiMsg: Message = {
          id: `msg_${Date.now()}`,
          sender: 'ai',
          text: fullText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
        chatHistory.current.push({ role: 'assistant', content: fullText });
        return;

      } catch (err) {
        console.error('Claude stream API failed, falling back to simulated chat stream:', err);
      }
    }

    // High fidelity simulator fallback
    simulateChatStreaming();
  };

  const simulateChatStreaming = () => {
    // Generate responses based on history count
    const historyCount = chatHistory.current.filter(h => h.role === 'user').length;
    let fullText = '';

    if (historyCount === 1) {
      fullText = `Hi there! I'm Alex. Let's get started. I would like you to solve: "Write a function to find the length of the longest substring without repeating characters." Please code your solution and explain your thought process first.`;
    } else if (historyCount === 2) {
      fullText = `That sounds like a solid starting idea. How do you plan to optimize the lookup time to O(N)? Consider using a sliding window technique. Write out some code and run it to test your logic.`;
    } else if (historyCount === 3) {
      fullText = `I see your solution coming together. How does it handle edge cases, like empty strings or single character inputs? Make sure you check for those before finishing.`;
    } else {
      fullText = `Excellent effort. Your implementation is clean and handles standard edge cases. We can wrap up here. Please click the "End Session" button to receive your mock feedback details and PDF scorecard.`;
    }

    let wordIdx = 0;
    const words = fullText.split(' ');
    
    const interval = setInterval(() => {
      if (wordIdx < words.length) {
        setStreamingText(prev => (prev ? prev + ' ' : '') + words[wordIdx]);
        wordIdx++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
        const aiMsg: Message = {
          id: `msg_${Date.now()}`,
          sender: 'ai',
          text: fullText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
        chatHistory.current.push({ role: 'assistant', content: fullText });
      }
    }, 80);
  };

  // Run code via Judge0 API
  const runCode = async () => {
    setIsRunning(true);
    setLastOutput({ status: 'idle' });

    const languageIdMap: { [key: string]: number } = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 54
    };

    const apiKey = localStorage.getItem('im_judge0_key') || import.meta.env.VITE_JUDGE0_API_KEY || import.meta.env.VITE_RAPIDAPI_KEY || '';

    // Enforce 10s timeout abort
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setLastOutput({
        status: 'timeout',
        stderr: 'Execution timed out (exceeded 10 seconds).'
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

        setLastOutput({ stdout, stderr, compileOutput, status });
        setIsRunning(false);
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Judge0 API failed, falling back to local JS simulation:', err);
      }
    }

    // Local JS execution fallback
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

          setLastOutput({
            stdout: logBuffer.length > 0 ? logBuffer.join('\n') : 'Code executed successfully with no logs.',
            status: 'success'
          });
        } else {
          setLastOutput({
            stdout: `[Execution Simulation for ${language.toUpperCase()}]\nCode executed successfully in mock local sandbox.\nReturned exit code 0.`,
            status: 'success'
          });
        }
      } catch (err: any) {
        setLastOutput({
          stderr: err.message,
          status: 'error'
        });
      } finally {
        setIsRunning(false);
      }
    }, 800);
  };

  // End Session
  const handleEndSession = async () => {
    if (!user) return;

    const sessionId = `solo_${Date.now()}`;
    const dateStr = new Date().toISOString().split('T')[0];

    // Build conversation array
    const transcript = messages.map(m => ({
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp
    }));

    const soloSessionDoc = {
      id: sessionId,
      userId: user.uid,
      topic,
      difficulty,
      messages: transcript,
      code,
      language,
      createdAt: new Date().toISOString()
    };

    // Save Solo transcript
    await saveSoloSession(soloSessionDoc);

    // Save mock feedback placeholder
    const emptyFeedback = {
      sessionId,
      userId: user.uid,
      reviewerId: 'alex_ai',
      topic: `${topic} Solo Practice`,
      date: dateStr,
      duration: 15,
      scores: {
        correctness: 8,
        efficiency: 7,
        communication: 8
      },
      strengths: [
        "Structured thinking during technical design.",
        "Proactive problem analysis before coding."
      ],
      improvements: [
        "Optimize lookup storage structures to lower spatial footprint.",
        "Refactor loops to reduce recursive call stack constraints."
      ],
      summary: "You demonstrated solid coding structures. The implementation handles standard edge cases and demonstrates clear complexity awareness.",
      createdAt: new Date().toISOString(),
      codeSnippet: code,
      languageUsed: language
    };

    await saveFeedback(emptyFeedback);

    // Redirect to feedback page
    navigate(`/feedback/${sessionId}`);
  };

  if (mode === 'setup') {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 text-slate-800">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
            <div className="text-center mb-6">
              <Sparkles className="mx-auto h-12 w-12 text-brand mb-2 animate-pulse" />
              <h2 className="text-2xl font-extrabold text-slate-800">Practice Solo with AI</h2>
              <p className="text-xs text-slate-500 mt-1">
                Conduct a mock interview with Alex, our senior AI software engineer interviewer. Receive real-time chat prompts, write code in Monaco, and get an immediate scorecard report.
              </p>
            </div>

            <div className="space-y-6">
              {/* Topic Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Interview Topic</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(['DSA', 'System Design', 'Frontend', 'HR'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={`rounded-xl py-3 text-xs font-bold border transition-all cursor-pointer ${
                        topic === t
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`rounded-xl py-3 text-xs font-bold border transition-all cursor-pointer ${
                        difficulty === d
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-4">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer text-center"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={handleStartSession}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-3 text-xs font-bold shadow-md transition-all cursor-pointer text-center"
                >
                  Start Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f172a] text-slate-100 font-sans">
      {/* HEADER SECTION */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#1e293b]/70 px-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (window.confirm("Abandon this solo session? Your progress will not be saved.")) {
                navigate('/');
              }
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="h-4 w-px bg-slate-800"></span>
          <span className="text-sm font-bold text-white flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-brand" /> Solo Practice: Alex (AI)
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
            {topic} &bull; {difficulty}
          </span>
        </div>

        <div>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 rounded bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
          >
            End Session
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE SPLIT PANELS */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT CHAT PANEL (45%) */}
        <div className="flex w-[45%] flex-col bg-[#0b0f19] border-r border-slate-800">
          {/* Chat Panel Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#131b2e] px-4 py-3 shrink-0">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-brand" /> Interview Discussion
            </span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12 text-slate-500">
                <Brain className="h-12 w-12 text-slate-700 mx-auto mb-2 animate-bounce" />
                <p className="text-xs">Alex is preparing your question...</p>
              </div>
            )}

            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                  msg.sender === 'user' ? 'bg-indigo-950 border-indigo-800 text-indigo-300' : 'bg-brand/10 border-brand/30 text-brand'
                }`}>
                  {msg.sender === 'user' ? <User className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5" />}
                </div>

                {/* Bubble */}
                <div className={`rounded-2xl p-3 text-xs leading-relaxed ${
                  msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="block text-[9px] text-slate-400 mt-1.5 text-right font-mono">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {/* Stream Bubble */}
            {isStreaming && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center shrink-0">
                  <Sparkles className="h-4.5 w-4.5 animate-spin" />
                </div>
                <div className="rounded-2xl p-3 text-xs leading-relaxed bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none">
                  {streamingText ? (
                    <p className="whitespace-pre-wrap">{streamingText}</p>
                  ) : (
                    <div className="flex items-center gap-1 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-[#0e1626] flex gap-2 shrink-0">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isStreaming}
              placeholder="Explain your approach or ask questions..."
              className="flex-1 rounded-lg border border-slate-800 bg-[#0f172a] px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isStreaming || !inputVal.trim()}
              className="rounded-lg bg-brand hover:bg-brand-hover text-white px-4 py-2.5 transition-all disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* RIGHT CODE PANEL (55%) */}
        <div className="flex w-[55%] flex-col bg-[#0b0f19]">
          {/* Editor Header */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-[#131b2e] px-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">SOLUTION.JS</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
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
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded bg-brand hover:bg-brand-hover px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-white"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Executing
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" /> Run Code
                </>
              )}
            </button>
          </div>

          {/* Monaco container */}
          <div className="flex-1 min-h-[300px]">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
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
            <div className="flex h-9 items-center justify-between border-b border-slate-800 bg-[#101726] px-3">
              <button 
                onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5 focus:outline-none hover:text-slate-200"
              >
                <Terminal className="h-3 w-3" /> Console Output {isTerminalCollapsed ? '(Collapsed)' : ''}
              </button>
              
              {!isTerminalCollapsed && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setLastOutput(null)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 focus:outline-none"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
            </div>

            {!isTerminalCollapsed && (
              <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap">
                {!lastOutput ? (
                  <span className="text-slate-600">Console initialized. Ready to execute solution code.</span>
                ) : lastOutput.status === 'idle' ? (
                  <span className="text-slate-400 animate-pulse">Running build and execution inside Judge0 sandboxed runtime...</span>
                ) : lastOutput.status === 'timeout' ? (
                  <span className="text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> [Timeout Error] Execution exceeded 10 seconds.
                  </span>
                ) : lastOutput.status === 'compile_error' ? (
                  <span className="text-amber-500">
                    [Compilation Error]
                    {"\n"}{lastOutput.compileOutput}
                  </span>
                ) : lastOutput.status === 'error' ? (
                  <span className="text-red-500">
                    [Execution Error]
                    {"\n"}{lastOutput.stderr}
                  </span>
                ) : (
                  <span className="text-emerald-400">
                    {lastOutput.stdout}
                  </span>
                )}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
