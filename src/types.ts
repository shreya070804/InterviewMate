export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'interviewer' | 'interviewee' | 'both';
  skills: string[];
  onboarded: boolean;
  createdAt?: any;
}

export interface Session {
  id: string;
  topic: 'DSA' | 'System Design' | 'Frontend' | 'HR';
  topicDetail: string;
  date: string;
  time: string;
  duration: number;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  status: 'scheduled' | 'active' | 'completed';
  createdAt: any;
  inviteLink: string;
  code?: string;
  language?: string;
  activeQuestionId?: string | null;
  activeMode?: 'code' | 'whiteboard';
  whiteboard?: {
    elements: any[];
    appState: any;
  };
  lastOutput?: {
    stdout?: string;
    stderr?: string;
    compileOutput?: string;
    status: 'success' | 'error' | 'compile_error' | 'timeout' | 'idle';
  } | null;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'DSA' | 'System Design' | 'HR' | 'Frontend';
}

export interface Feedback {
  sessionId: string;
  userId: string;
  reviewerId: string;
  topic: string;
  date: string;
  duration: number;
  scores: {
    correctness: number; // 1-10
    efficiency: number;   // 1-10
    communication: number; // 1-10
  };
  strengths: string[];
  improvements: string[];
  summary: string;
  createdAt: any;
  codeSnippet?: string;
  languageUsed?: string;
  sessionSummary?: {
    what_was_attempted: string;
    what_went_well: string;
    biggest_gap: string;
    top_study_topic: string;
    estimated_readiness: number;
  };
}

export interface SoloSession {
  id: string;
  userId: string;
  topic: 'DSA' | 'System Design' | 'Frontend' | 'HR';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  messages: {
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
  }[];
  code: string;
  language: string;
  createdAt: any;
}

