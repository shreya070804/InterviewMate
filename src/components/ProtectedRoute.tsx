import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode; requireOnboarded?: boolean }> = ({ 
  children, 
  requireOnboarded = true 
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fcfcfc]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading InterviewMate...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save current location
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireOnboarded && profile && !profile.onboarded) {
    // Redirect to onboarding if not done yet
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
