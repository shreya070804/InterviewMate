import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { UserProfile, Session, Question, Feedback } from './types';


// Environment variables
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

const isFirebaseConfigured = !!(apiKey && authDomain && projectId);

let firebaseApp: any = null;
let firebaseAuth: any = null;
let firestoreDb: any = null;
let firebaseFunctions: any = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    }) : getApp();
    firebaseAuth = getAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);
    firebaseFunctions = getFunctions(firebaseApp);
    console.log("Firebase initialized successfully in Real Mode.");
  } catch (error) {
    console.error("Error initializing Firebase, falling back to Mock Mode:", error);
  }
} else {
  console.warn("Firebase credentials missing. InterviewMate is running in Mock Mode (using LocalStorage & Memory).");
}

export const MOCK_MODE = !firebaseAuth || !firestoreDb;

// PRE-SEEDED QUESTIONS
export const PRE_SEEDED_QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'Two Sum',
    category: 'DSA',
    difficulty: 'Easy',
    description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].'
  },
  {
    id: 'q2',
    title: 'Reverse a Linked List',
    category: 'DSA',
    difficulty: 'Easy',
    description: 'Given the head of a singly linked list, reverse the list, and return the reversed list.\n\nExample:\nInput: head = [1,2,3,4,5]\nOutput: [5,4,3,2,1]'
  },
  {
    id: 'q3',
    title: 'Validate Binary Search Tree',
    category: 'DSA',
    difficulty: 'Medium',
    description: 'Given the root of a binary tree, determine if it is a valid binary search tree (BST).\n\nA valid BST is defined as follows:\n- The left subtree of a node contains only nodes with keys less than the node\'s key.\n- The right subtree of a node contains only nodes with keys greater than the node\'s key.\n- Both the left and right subtrees must also be binary search trees.'
  },
  {
    id: 'q4',
    title: 'Merge Intervals',
    category: 'DSA',
    difficulty: 'Medium',
    description: 'Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.\n\nExample:\nInput: intervals = [[1,3],[2,6],[8,10],[15,18]]\nOutput: [[1,6],[8,10],[15,18]]\nExplanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6].'
  },
  {
    id: 'q5',
    title: 'LRU Cache',
    category: 'DSA',
    difficulty: 'Hard',
    description: 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the LRUCache class:\n- `LRUCache(int capacity)` Initialize the LRU cache with positive size capacity.\n- `int get(int key)` Return the value of the key if the key exists, otherwise return -1.\n- `void put(int key, int value)` Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.'
  },
  {
    id: 'q6',
    title: 'Design a URL Shortener',
    category: 'System Design',
    difficulty: 'Medium',
    description: 'Design a system like TinyURL. It should take a long URL and return a short unique URL. It should also redirect users to the original URL when the short URL is accessed.\n\nKey Requirements:\n- High availability and scalability (millions of requests per day).\n- Low latency redirection.\n- Customizable short links (optional).\n- Analytics for link clicks (optional).'
  },
  {
    id: 'q7',
    title: 'Design a Real-Time Chat System',
    category: 'System Design',
    difficulty: 'Medium',
    description: 'Design a scalable real-time messaging system like WhatsApp or Slack.\n\nKey Requirements:\n- Support 1-on-1 private messaging and group chats.\n- Real-time message delivery with low latency.\n- Online/Offline status indicators.\n- Support message storage for offline users.'
  },
  {
    id: 'q8',
    title: 'Design Netflix / Video Streaming Service',
    category: 'System Design',
    difficulty: 'Hard',
    description: 'Design a system that streams movies and TV shows to millions of active users.\n\nKey Requirements:\n- Low buffering and high-quality video streaming across different devices and internet speeds.\n- Content Delivery Network (CDN) deployment.\n- Content uploading and transcoding system.\n- Personalized search and recommendations.'
  },
  {
    id: 'q9',
    title: 'Design an API Rate Limiter',
    category: 'System Design',
    difficulty: 'Medium',
    description: 'Design an API Rate Limiter to protect a web service from abuse, denial of service (DoS) attacks, or resource exhaustion.\n\nKey Requirements:\n- Custom rate limiting rules (e.g. 100 requests per minute).\n- Low memory usage and ultra-low latency impact on incoming API requests.\n- Distributed operations (cluster of web servers).'
  },
  {
    id: 'q10',
    title: 'Custom React hook: useDebounce',
    category: 'Frontend',
    difficulty: 'Easy',
    description: 'Write a custom React hook called `useDebounce` that delays updating a value until after a specified delay has elapsed.\n\nThis is commonly used for search inputs to prevent making API calls on every keystroke.'
  },
  {
    id: 'q11',
    title: 'Autocomplete Search Component',
    category: 'Frontend',
    difficulty: 'Medium',
    description: 'Create an Autocomplete Input search component in React that fetches matching results as the user types.\n\nKey requirements:\n- Handle debouncing inputs to avoid network spamming.\n- Support keyboard navigation (Up, Down, Enter keys).\n- Render suggestions dynamically and highlight matching characters.'
  },
  {
    id: 'q12',
    title: 'Virtual Scroll List',
    category: 'Frontend',
    difficulty: 'Hard',
    description: 'Implement a Virtual Scroll list component that can render a list of 100,000 items smoothly in the DOM by only rendering the elements currently visible in the viewport.'
  },
  {
    id: 'q13',
    title: 'Nested Comments Thread',
    category: 'Frontend',
    difficulty: 'Medium',
    description: 'Design a Reddit-style nested comments thread component in React.\n\nKey requirements:\n- Recursive rendering of replies.\n- Actions: Reply, Edit, Delete comment.\n- Expand/Collapse threads.'
  },
  {
    id: 'q14',
    title: 'Resolving Conflicts in a Team',
    category: 'HR',
    difficulty: 'Easy',
    description: 'Describe a time when you had a disagreement or conflict with a team member (e.g., about a design decision or code review). How did you handle it, and what was the outcome?\n\nFocus on constructive communication, active listening, and finding a win-win resolution.'
  },
  {
    id: 'q15',
    title: 'Why InterviewMate?',
    category: 'HR',
    difficulty: 'Easy',
    description: 'Why do you want to join our engineering team, and what draws you to this product?\n\nTip: Mention your passion for peer-to-peer learning, mentorship, or building highly interactive interfaces.'
  }
];

// Local state helpers for Mock Mode
const getLocalData = (key: string, defaultValue: any) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocalData = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// MOCK DATA SEEDING
if (MOCK_MODE) {
  if (!localStorage.getItem('im_questions')) {
    setLocalData('im_questions', PRE_SEEDED_QUESTIONS);
  }
  if (!localStorage.getItem('im_users')) {
    setLocalData('im_users', {});
  }
  if (!localStorage.getItem('im_sessions')) {
    setLocalData('im_sessions', []);
  }
  if (!localStorage.getItem('im_feedback')) {
    setLocalData('im_feedback', []);
  }
}

// ----------------------------------------------------
// AUTHENTICATION APIs
// ----------------------------------------------------

export interface IMUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

let mockUserListener: ((user: IMUser | null) => void) | null = null;
let currentMockUser: IMUser | null = null;

// Initialize mock user session if exists
if (MOCK_MODE) {
  const savedUser = localStorage.getItem('im_current_user');
  if (savedUser) {
    currentMockUser = JSON.parse(savedUser);
  }
}

export const subscribeToAuth = (callback: (user: IMUser | null) => void) => {
  if (!MOCK_MODE) {
    return onAuthStateChanged(firebaseAuth, (user: FirebaseUser | null) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Developer',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`
        });
      } else {
        callback(null);
      }
    });
  } else {
    mockUserListener = callback;
    // Call initial state
    callback(currentMockUser);
    return () => {
      mockUserListener = null;
    };
  }
};

export const signInWithGoogle = async (): Promise<IMUser> => {
  if (!MOCK_MODE) {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Developer',
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`
    };
  } else {
    const randomId = Math.random().toString(36).substring(2, 11);
    const mockUser: IMUser = {
      uid: `google_${randomId}`,
      email: 'user@google-demo.com',
      displayName: 'Google Mock User',
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=google_${randomId}`
    };
    currentMockUser = mockUser;
    localStorage.setItem('im_current_user', JSON.stringify(mockUser));
    if (mockUserListener) mockUserListener(mockUser);
    return mockUser;
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<IMUser> => {
  if (!MOCK_MODE) {
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || email.split('@')[0],
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`
    };
  } else {
    // Simple mock logic: check credentials in local store
    const users = getLocalData('im_users', {});
    const cleanEmail = email.toLowerCase().trim();
    
    // Check if user exists
    const existingUser = Object.values(users).find((u: any) => u.email === cleanEmail) as any;
    if (!existingUser) {
      throw new Error("User does not exist. Please register first.");
    }
    
    const mockUser: IMUser = {
      uid: existingUser.uid,
      email: existingUser.email,
      displayName: existingUser.displayName,
      photoURL: existingUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${existingUser.uid}`
    };
    currentMockUser = mockUser;
    localStorage.setItem('im_current_user', JSON.stringify(mockUser));
    if (mockUserListener) mockUserListener(mockUser);
    return mockUser;
  }
};

export const registerWithEmail = async (email: string, password: string, name: string): Promise<IMUser> => {
  if (!MOCK_MODE) {
    const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    const user = result.user;
    
    // Save minimal profile
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: name,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
      role: 'both',
      skills: [],
      onboarded: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(firestoreDb, 'users', user.uid), profile);
    
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: name,
      photoURL: profile.photoURL
    };
  } else {
    const users = getLocalData('im_users', {});
    const cleanEmail = email.toLowerCase().trim();
    
    // Check if user already exists
    const duplicate = Object.values(users).find((u: any) => u.email === cleanEmail);
    if (duplicate) {
      throw new Error("Email already registered.");
    }
    
    const randomId = Math.random().toString(36).substring(2, 11);
    const uid = `email_${randomId}`;
    const mockUser: IMUser = {
      uid,
      email: cleanEmail,
      displayName: name,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`
    };
    
    // Write profile
    const profile: UserProfile = {
      uid,
      email: cleanEmail,
      displayName: name,
      photoURL: mockUser.photoURL,
      role: 'both',
      skills: [],
      onboarded: false,
      createdAt: new Date().toISOString()
    };
    
    users[uid] = profile;
    setLocalData('im_users', users);
    
    currentMockUser = mockUser;
    localStorage.setItem('im_current_user', JSON.stringify(mockUser));
    if (mockUserListener) mockUserListener(mockUser);
    return mockUser;
  }
};

export const logoutUser = async (): Promise<void> => {
  if (!MOCK_MODE) {
    await signOut(firebaseAuth);
  } else {
    currentMockUser = null;
    localStorage.removeItem('im_current_user');
    if (mockUserListener) mockUserListener(null);
  }
};

// ----------------------------------------------------
// USER PROFILE APIs
// ----------------------------------------------------

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
  } else {
    const users = getLocalData('im_users', {});
    return users[uid] || null;
  }
};

export const saveUserProfile = async (uid: string, profile: Partial<UserProfile>): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'users', uid);
    await setDoc(docRef, profile, { merge: true });
  } else {
    const users = getLocalData('im_users', {});
    const existing = users[uid] || { uid, onboarded: false };
    users[uid] = { ...existing, ...profile };
    setLocalData('im_users', users);
  }
};

// ----------------------------------------------------
export const createSession = async (session: Omit<Session, 'id' | 'createdAt' | 'status' | 'inviteLink'>): Promise<Session> => {
  const sessionId = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7);
  const inviteLink = `${window.location.origin}/room/${sessionId}`;

  
  const newSession: Session = {
    ...session,
    id: sessionId,
    status: 'scheduled',
    inviteLink,
    createdAt: new Date().toISOString(),
  };

  if (!MOCK_MODE) {
    await setDoc(doc(firestoreDb, 'sessions', sessionId), {
      ...newSession,
      createdAt: serverTimestamp()
    });
    return newSession;
  } else {
    const sessions = getLocalData('im_sessions', []);
    sessions.push(newSession);
    setLocalData('im_sessions', sessions);
    return newSession;
  }
};

export const updateSession = async (sessionId: string, updates: Partial<Session>): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'sessions', sessionId);
    await updateDoc(docRef, updates);
  } else {
    const sessions = getLocalData('im_sessions', []);
    const updated = sessions.map((s: Session) => s.id === sessionId ? { ...s, ...updates } : s);
    setLocalData('im_sessions', updated);
    // Dispatch storage event to trigger listener in other tab
    window.dispatchEvent(new Event('storage'));
  }
};

/**
 * Delete a session document.
 * In real mode, deletes from Firestore. In mock mode, removes from local storage and dispatches a storage event.
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'sessions', sessionId);
    await deleteDoc(docRef);
  } else {
    const sessions = getLocalData('im_sessions', []);
    const updated = sessions.filter((s: Session) => s.id !== sessionId);
    setLocalData('im_sessions', updated);
    window.dispatchEvent(new Event('storage'));
  }
};

export const joinSession = async (sessionId: string, guestId: string, guestName: string): Promise<void> => {
  await updateSession(sessionId, {
    guestId,
    guestName,
  });
};

export const subscribeToSession = (sessionId: string, callback: (session: Session | null) => void) => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'sessions', sessionId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as Session);
      } else {
        callback(null);
      }
    });
  } else {
    const checkSession = () => {
      const sessions = getLocalData('im_sessions', []);
      const match = sessions.find((s: Session) => s.id === sessionId) || null;
      callback(match);
    };

    checkSession();
    
    // Listen to storage events or custom local updates
    const storageHandler = () => {
      checkSession();
    };
    window.addEventListener('storage', storageHandler);
    // Also poll every 1 second in mock mode for snappy sync inside same browser different tabs
    const intervalId = setInterval(checkSession, 1000);
    
    return () => {
      window.removeEventListener('storage', storageHandler);
      clearInterval(intervalId);
    };
  }
};

export const subscribeToUserSessions = (userId: string, callback: (sessions: Session[]) => void) => {
  if (!MOCK_MODE) {
    const collRef = collection(firestoreDb, 'sessions');
    // Read all where hostId = userId OR guestId = userId
    // Firestore queries with multiple fields or OR are a bit limited without composite indexes, so we can do two simple queries and merge them,
    // or just listen to all sessions and filter on client for mock simplicity, or query client.
    // For safety, let's query all sessions where hostId == userId or guestId == userId.
    const q1 = query(collRef, where('hostId', '==', userId));
    const q2 = query(collRef, where('guestId', '==', userId));
    
    let list1: Session[] = [];
    let list2: Session[] = [];
    
    const unsubscribe1 = onSnapshot(q1, (snap) => {
      list1 = snap.docs.map(d => d.data() as Session);
      const combined = [...list1, ...list2].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      callback(combined);
    });

    const unsubscribe2 = onSnapshot(q2, (snap) => {
      list2 = snap.docs.map(d => d.data() as Session);
      const combined = [...list1, ...list2].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      callback(combined);
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  } else {
    const fetchUserSessions = () => {
      const sessions = getLocalData('im_sessions', []);
      const filtered = sessions.filter((s: Session) => s.hostId === userId || s.guestId === userId);
      callback(filtered);
    };

    fetchUserSessions();
    window.addEventListener('storage', fetchUserSessions);
    const intervalId = setInterval(fetchUserSessions, 2000);

    return () => {
      window.removeEventListener('storage', fetchUserSessions);
      clearInterval(intervalId);
    };
  }
};

// ----------------------------------------------------
// QUESTIONS APIs
// ----------------------------------------------------

// Pre‑seeded Question Packs (Company‑specific)
const QUESTION_PACKS: QuestionPack[] = [
  {
    id: 'pack_google',
    companyName: 'Google',
    companyLogo: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
    description: 'Google‑style questions focusing on system design and algorithms.',
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5']
  },
  {
    id: 'pack_amazon',
    companyName: 'Amazon',
    companyLogo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    description: 'Amazon‑style questions emphasizing leadership principles and problem solving.',
    questionIds: ['q6', 'q7', 'q8', 'q9', 'q10']
  },
  {
    id: 'pack_startup',
    companyName: 'Startup',
    companyLogo: 'https://cdn-icons-png.flaticon.com/512/3063/3063696.png',
    description: 'Startup‑style full‑stack generalist questions.',
    questionIds: ['q11', 'q12', 'q13', 'q14', 'q15']
  }
];

/**
 * Fetch the curated question packs.
 * In real mode it reads from the `question_packs` collection; in mock mode it returns the hard‑coded list.
 */
export const getQuestionPacks = async (): Promise<QuestionPack[]> => {
  if (!MOCK_MODE) {
    const collRef = collection(firestoreDb, 'question_packs');
    const snap = await getDocs(collRef);
    if (snap.empty) {
      // Seed the packs on first call
      for (const pack of QUESTION_PACKS) {
        await setDoc(doc(firestoreDb, 'question_packs', pack.id), pack);
      }
      return QUESTION_PACKS;
    }
    return snap.docs.map(d => d.data() as QuestionPack);
  } else {
    // Mock mode – simply return the constant list
    return QUESTION_PACKS;
  }
};

export const getQuestions = async (): Promise<Question[]> => {
  if (!MOCK_MODE) {
    const collRef = collection(firestoreDb, 'questions');
    const snap = await getDocs(collRef);
    if (snap.empty) {
      // Seed Firestore
      for (const q of PRE_SEEDED_QUESTIONS) {
        await setDoc(doc(firestoreDb, 'questions', q.id), q);
      }
      return PRE_SEEDED_QUESTIONS;
    }
    return snap.docs.map(d => d.data() as Question);
  } else {
    return getLocalData('im_questions', PRE_SEEDED_QUESTIONS);
  }
};

// ----------------------------------------------------
// FEEDBACK APIs
// ----------------------------------------------------

export const saveFeedback = async (feedback: Feedback): Promise<void> => {
  if (!MOCK_MODE) {
    await setDoc(doc(firestoreDb, 'feedback', feedback.sessionId), {
      ...feedback,
      createdAt: serverTimestamp()
    });
  } else {
    const allFeedback = getLocalData('im_feedback', []);
    // check if feedback already exists
    const idx = allFeedback.findIndex((f: Feedback) => f.sessionId === feedback.sessionId);
    if (idx >= 0) {
      allFeedback[idx] = feedback;
    } else {
      allFeedback.push(feedback);
    }
    setLocalData('im_feedback', allFeedback);
  }
};

export const getFeedback = async (sessionId: string): Promise<Feedback | null> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'feedback', sessionId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Feedback) : null;
  } else {
    const allFeedback = getLocalData('im_feedback', []);
    return allFeedback.find((f: Feedback) => f.sessionId === sessionId) || null;
  }
};

export const getUserFeedbackList = async (userId: string): Promise<Feedback[]> => {
  if (!MOCK_MODE) {
    const collRef = collection(firestoreDb, 'feedback');
    const q = query(collRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Feedback);
  } else {
    const allFeedback = getLocalData('im_feedback', []);
    return allFeedback.filter((f: Feedback) => f.userId === userId || f.reviewerId === userId);
  }
};

// ----------------------------------------------------
// MATCHMAKING & TRANSCRIPT & QUESTION SAVING APIs
// ----------------------------------------------------

export const saveQuestion = async (question: Question): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'questions', question.id);
    await setDoc(docRef, question);
  } else {
    const questionsList = getLocalData('im_questions', PRE_SEEDED_QUESTIONS);
    if (!questionsList.some((q: Question) => q.id === question.id)) {
      questionsList.push(question);
      setLocalData('im_questions', questionsList);
      window.dispatchEvent(new Event('storage'));
    }
  }
};

export const saveSoloSession = async (session: any): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'solo_sessions', session.id);
    await setDoc(docRef, {
      ...session,
      createdAt: serverTimestamp()
    });
  } else {
    const allSolo = getLocalData('im_solo_sessions', []);
    allSolo.push(session);
    setLocalData('im_solo_sessions', allSolo);
    window.dispatchEvent(new Event('storage'));
  }
};

export const addToMatchmakingQueue = async (userId: string, topic: string, displayName: string): Promise<string> => {
  const queueId = Math.random().toString(36).substring(2, 11);
  const queueDoc = {
    id: queueId,
    userId,
    topic,
    status: 'waiting',
    createdAt: new Date().toISOString(),
    sessionId: null
  };

  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'matchmaking_queue', queueId);
    await setDoc(docRef, queueDoc);
    return queueId;
  } else {
    const queue = getLocalData('im_matchmaking_queue', {});
    queue[queueId] = queueDoc;
    setLocalData('im_matchmaking_queue', queue);
    window.dispatchEvent(new Event('storage'));

    // Simulate Background Cloud Function Matchmaker in Mock Mode
    setTimeout(() => {
      const currentQueue = getLocalData('im_matchmaking_queue', {});
      const userDoc = currentQueue[queueId];
      
      // If user hasn't cancelled or matched yet
      if (userDoc && userDoc.status === 'waiting') {
        const sessionId = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7);
        const inviteLink = `${window.location.origin}/room/${sessionId}`;
        const topicDetail = 
          topic === 'DSA' ? 'Data Structures & Algorithms' : 
          topic === 'System Design' ? 'System Design: Architecture' : 
          topic === 'Frontend' ? 'Frontend Development' : 'HR & Behavioural';

        // Create the session
        const newSession: Session = {
          id: sessionId,
          topic: topic as any,
          topicDetail,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: 45,
          hostId: userId,
          hostName: displayName,
          guestId: 'mock_peer_123',
          guestName: 'Alex (AI Partner)',
          status: 'scheduled',
          inviteLink,
          code: '// Enter your solution here\n\nfunction solve() {\n  \n}',
          language: 'javascript',
          createdAt: new Date().toISOString(),
        };

        // Save session
        const sessions = getLocalData('im_sessions', []);
        sessions.push(newSession);
        setLocalData('im_sessions', sessions);

        // Update queue doc
        userDoc.status = 'matched';
        userDoc.sessionId = sessionId;
        currentQueue[queueId] = userDoc;
        setLocalData('im_matchmaking_queue', currentQueue);
        window.dispatchEvent(new Event('storage'));

        // Delete after 5 seconds
        setTimeout(() => {
          const postQueue = getLocalData('im_matchmaking_queue', {});
          delete postQueue[queueId];
          setLocalData('im_matchmaking_queue', postQueue);
          window.dispatchEvent(new Event('storage'));
        }, 5000);
      }
    }, 4000);

    return queueId;
  }
};

export const removeFromMatchmakingQueue = async (queueId: string): Promise<void> => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'matchmaking_queue', queueId);
    await deleteDoc(docRef);
  } else {
    const queue = getLocalData('im_matchmaking_queue', {});
    delete queue[queueId];
    setLocalData('im_matchmaking_queue', queue);
    window.dispatchEvent(new Event('storage'));
  }
};

export const subscribeToQueueItem = (queueId: string, callback: (data: any) => void) => {
  if (!MOCK_MODE) {
    const docRef = doc(firestoreDb, 'matchmaking_queue', queueId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    });
  } else {
    const checkQueue = () => {
      const queue = getLocalData('im_matchmaking_queue', {});
      callback(queue[queueId] || null);
    };

    checkQueue();
    window.addEventListener('storage', checkQueue);
    const intervalId = setInterval(checkQueue, 1000);

    return () => {
      window.removeEventListener('storage', checkQueue);
      clearInterval(intervalId);
    };
  }
};

export const uploadAndParseResume = async (userId: string, pdfBase64: string): Promise<string> => {
  if (!MOCK_MODE) {
    const parseFn = httpsCallable(firebaseFunctions, 'parseResume');
    const result = await parseFn({ pdfBase64 });
    const text = (result.data as any).text || '';
    return text;
  } else {
    // Mock Mode
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResumeText = `
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

        // Update profile
        const users = getLocalData('im_users', {});
        if (users[userId]) {
          users[userId].resumeText = mockResumeText;
          setLocalData('im_users', users);
        }
        window.dispatchEvent(new Event('storage'));
        resolve(mockResumeText);
      }, 1500);
    });
  }
};

export const triggerMockLeaderboardCalculation = async (userId: string): Promise<void> => {
  if (MOCK_MODE) {
    const optIns = getLocalData('im_leaderboard_opt_in', {});
    
    // Seed some mock players with scores
    const mockPlayers = [
      { userId: 'mock_1', displayName: 'Priya Patel', avgScore: 9.2, sessionsCompleted: 14, optedIn: true },
      { userId: 'mock_2', displayName: 'Rohan Sharma', avgScore: 8.8, sessionsCompleted: 11, optedIn: true },
      { userId: 'mock_3', displayName: 'Emily Watson', avgScore: 8.5, sessionsCompleted: 9, optedIn: true },
      { userId: 'mock_4', displayName: 'David Kim', avgScore: 8.1, sessionsCompleted: 7, optedIn: true },
      { userId: 'mock_5', displayName: 'Siddharth M.', avgScore: 7.9, sessionsCompleted: 12, optedIn: true },
      { userId: 'mock_6', displayName: 'Sarah Jenkins', avgScore: 7.6, sessionsCompleted: 5, optedIn: true },
      { userId: 'mock_7', displayName: 'Amit Goel', avgScore: 7.3, sessionsCompleted: 4, optedIn: true },
      { userId: 'mock_8', displayName: 'Carlos Ruiz', avgScore: 6.9, sessionsCompleted: 3, optedIn: true }
    ];

    // Compute the current user's score from im_feedback
    const feedbackList = getLocalData('im_feedback', []);
    const userFeedback = feedbackList.filter((f: any) => f.userId === userId || f.reviewerId === userId);
    
    let userAvg = 0;
    let userSessionsCount = userFeedback.length;
    if (userSessionsCount > 0) {
      const total = userFeedback.reduce((acc: number, f: any) => {
        return acc + (f.scores.correctness + f.scores.efficiency + f.scores.communication) / 3;
      }, 0);
      userAvg = parseFloat((total / userSessionsCount).toFixed(2));
    } else {
      // Default placeholder if they haven't finished any mock sessions
      userAvg = 7.8;
      userSessionsCount = 2;
    }

    const currentUserOptIn = optIns[userId];
    const userOptedIn = currentUserOptIn ? currentUserOptIn.optedIn : false;

    // Combine players
    const allOptedInPlayers = [...mockPlayers];
    if (userOptedIn) {
      const userProfile = getLocalData('im_users', {})[userId] || {};
      allOptedInPlayers.push({
        userId,
        displayName: userProfile.displayName || 'Developer (You)',
        avgScore: userAvg,
        sessionsCompleted: userSessionsCount,
        optedIn: true
      });
    }

    // Sort by avgScore desc, then by sessions completed desc
    allOptedInPlayers.sort((a, b) => b.avgScore - a.avgScore || b.sessionsCompleted - a.sessionsCompleted);

    // Write ranks
    const finalLeaderboard = allOptedInPlayers.map((player, index) => ({
      rank: index + 1,
      userId: player.userId,
      displayName: player.displayName,
      avgScore: player.avgScore,
      sessionsCompleted: player.sessionsCompleted,
      updatedAt: new Date().toISOString()
    }));

    setLocalData('im_weekly_leaderboard', finalLeaderboard);
    window.dispatchEvent(new Event('storage'));
  }
};

export const optInToLeaderboard = async (userId: string, optedIn: boolean, displayName: string): Promise<void> => {
  if (!MOCK_MODE) {
    await setDoc(doc(firestoreDb, 'leaderboard_opt_in', userId), {
      optedIn,
      userId,
      displayName,
      updatedAt: serverTimestamp()
    });
    await updateDoc(doc(firestoreDb, 'users', userId), {
      optedInLeaderboard: optedIn
    });
  } else {
    const optIns = getLocalData('im_leaderboard_opt_in', {});
    optIns[userId] = { optedIn, userId, displayName };
    setLocalData('im_leaderboard_opt_in', optIns);

    const users = getLocalData('im_users', {});
    if (users[userId]) {
      users[userId].optedInLeaderboard = optedIn;
      setLocalData('im_users', users);
    }
    window.dispatchEvent(new Event('storage'));
    
    // Trigger rank calculation so the leaderboard updates immediately in UI
    await triggerMockLeaderboardCalculation(userId);
  }
};

export const getWeeklyLeaderboard = async (): Promise<any[]> => {
  if (!MOCK_MODE) {
    const collRef = collection(firestoreDb, 'weekly_leaderboard');
    const snap = await getDocs(collRef);
    return snap.docs.map(d => d.data()).sort((a: any, b: any) => a.rank - b.rank);
  } else {
    // If not calculated yet, trigger a mock calculation
    let board = getLocalData('im_weekly_leaderboard', []);
    if (board.length === 0) {
      const currentUser = localStorage.getItem('im_current_user');
      const uid = currentUser ? JSON.parse(currentUser).uid : 'mock_user_123';
      await triggerMockLeaderboardCalculation(uid);
      board = getLocalData('im_weekly_leaderboard', []);
    }
    return board;
  }
};


