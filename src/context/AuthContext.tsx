import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  subscribeToAuth, 
  loginWithEmail, 
  registerWithEmail, 
  signInWithGoogle, 
  logoutUser, 
  getUserProfile, 
  saveUserProfile
} from '../firebase';
import type { IMUser } from '../firebase';
import type { UserProfile } from '../types';


interface AuthContextType {
  user: IMUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IMUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Fetch or create profile
          let userProfile = await getUserProfile(firebaseUser.uid);
          if (!userProfile) {
            // First time profile seed
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'both',
              skills: [],
              onboarded: false,
              createdAt: new Date().toISOString()
            };
            await saveUserProfile(firebaseUser.uid, userProfile);
          }
          setProfile(userProfile);
        } catch (err) {
          console.error("Error syncing user profile:", err);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      await registerWithEmail(email, password, name);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await saveUserProfile(user.uid, updates);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error("Error updating profile:", err);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
