export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'interviewer' | 'interviewee' | 'both';
  skills: string[];
  onboarded: boolean;
  createdAt?: any;
  resumeText?: string;
  optedInLeaderboard?: boolean;
  username?: string;
  bio?: string;
  badges?: string[];
  streak?: number;
  lastStreakUpdate?: any;
  hasCompletedOnboarding?: boolean;
  /** New onboarding survey fields */
  experienceLevel?: 'Student' | '0-1 yrs' | '1-3 yrs' | '3+ yrs';
  preparingFor?: 'Internships' | 'Full-time jobs' | 'Skill building';
  interviewPace?: 'Relaxed' | 'Standard' | 'Intense';
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
  hrTranscript?: string;
  reminderSent?: boolean;
  hrScores?: {
    clarity_score: number;
    structure_score: number;
    filler_word_count: number;
    feedback: string;
    confidence_score?: number;
    wpm?: number;
    pace_assessment?: 'too fast' | 'ideal' | 'too slow';
    specific_feedback?: string;
  } | null;
  hasObserver?: boolean;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'DSA' | 'System Design' | 'HR' | 'Frontend';
  embedding?: number[];
}

export interface QuestionPack {
  id: string;
  companyName: string;
  companyLogo: string;
  description: string;
  questionIds: string[];
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
  time_complexity?: string;
  space_complexity?: string;
  complexity_explanation?: string;
  nextRecommendation?: {
    recommended_question_id?: string | null;
    recommended_category?: 'DSA' | 'System Design' | 'Frontend' | 'HR' | null;
    reason: string;
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

export interface JDAnalysisResult {
  id?: string;
  jdText: string;
  matched_skills: string[];
  missing_skills: string[];
  weak_categories_for_this_role: string[];
  recommendation: string;
  createdAt: string;
}

