import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, Settings, LogOut, User, Menu, X, Sun, Moon, Sparkles } from 'lucide-react';
import { subscribeToApiUsage } from '../firebase';

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [apiCallsToday, setApiCallsToday] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToApiUsage(user.uid, (data) => {
      if (data) {
        const todayStr = new Date().toISOString().split('T')[0];
        let resetDateStr = '';
        if (data.lastResetDate) {
          if (typeof data.lastResetDate.toDate === 'function') {
            resetDateStr = data.lastResetDate.toDate().toISOString().split('T')[0];
          } else if (data.lastResetDate instanceof Date) {
            resetDateStr = data.lastResetDate.toISOString().split('T')[0];
          } else if (typeof data.lastResetDate === 'string') {
            resetDateStr = data.lastResetDate.split('T')[0];
          }
        }
        if (resetDateStr !== todayStr) {
          setApiCallsToday(0);
        } else {
          setApiCallsToday(data.claudeCallsToday || 0);
        }
      } else {
        setApiCallsToday(0);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-brand">InterviewMate</span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors hover:text-brand ${
                  isActive('/') ? 'text-brand border-b-2 border-brand py-5' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/leaderboard"
                className={`text-sm font-medium transition-colors hover:text-brand ${
                  isActive('/leaderboard') ? 'text-brand border-b-2 border-brand py-5' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Leaderboard
              </Link>
              <Link
                to="/history"
                className={`text-sm font-medium transition-colors hover:text-brand ${
                  isActive('/history') ? 'text-brand border-b-2 border-brand py-5' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                History
              </Link>
              <Link
                to="/skills"
                className={`text-sm font-medium transition-colors hover:text-brand ${
                  isActive('/skills') ? 'text-brand border-b-2 border-brand py-5' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Skill Tracker
              </Link>
              <span className="text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed">Resources</span>
            </div>
          </div>

          {/* User Controls */}
          {user && (
            <div className="hidden md:flex items-center gap-4">
              {/* API Calls Usage Indicator */}
              <div className="group relative flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 px-3 py-1.5 text-xs font-semibold text-slate-650 dark:text-slate-350 transition-all cursor-help hover:bg-slate-100 dark:hover:bg-slate-850/50">
                <Sparkles className="h-3.5 w-3.5 text-brand shrink-0" />
                <span>{apiCallsToday}/50 AI calls today</span>
                
                {/* Tooltip */}
                <div className="absolute top-full right-0 mt-2 hidden group-hover:block w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 shadow-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 z-50 text-left">
                  This daily limit of 50 AI calls exists to keep Mock Interview evaluation sustainable for everyone. Resets daily at midnight.
                </div>
              </div>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme} 
                aria-label="Toggle dark and light visual theme"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
              </button>

              {/* Notification Bell */}
              <button 
                aria-label="View notifications"
                className="relative rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
              >
                <span className="sr-only">Notifications</span>
                <Bell className="h-5 w-5" aria-hidden="true" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-teal-600"></span>
              </button>

              {/* Settings Toggle */}
              <button 
                onClick={() => navigate('/onboarding')} 
                aria-label="Profile settings"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus:outline-none"
                title="Profile Settings"
              >
                <Settings className="h-5 w-5" aria-hidden="true" />
              </button>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="User profile menu"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 pr-3 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                >
                  <img
                    src={profile?.photoURL || user.photoURL}
                    alt={`${profile?.displayName || user.displayName || 'User'}'s profile avatar`}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                    {profile?.displayName || user.displayName}
                  </span>
                </button>

                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-1 shadow-lg ring-1 ring-black/5 z-40">
                      <Link
                        to="/onboarding"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <User className="h-4 w-4" />
                        Edit Profile
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle main menu"
              aria-expanded={mobileMenuOpen}
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-505 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-4 space-y-1">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`block rounded-md px-3 py-2 text-base font-medium ${
              isActive('/') ? 'bg-brand/10 text-brand' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className={`block rounded-md px-3 py-2 text-base font-medium ${
              isActive('/leaderboard') ? 'bg-brand/10 text-brand' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Leaderboard
          </Link>
          <Link
            to="/history"
            onClick={() => setMobileMenuOpen(false)}
            className={`block rounded-md px-3 py-2 text-base font-medium ${
              isActive('/history') ? 'bg-brand/10 text-brand' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            History
          </Link>
          <Link
            to="/skills"
            onClick={() => setMobileMenuOpen(false)}
            className={`block rounded-md px-3 py-2 text-base font-medium ${
              isActive('/skills') ? 'bg-brand/10 text-brand' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Skill Tracker
          </Link>
          <div className="border-t border-slate-100 dark:border-slate-800 my-2 pt-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <img
                src={profile?.photoURL || user.photoURL}
                alt={`${profile?.displayName || user.displayName || 'User'}'s profile avatar`}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{profile?.displayName || user.displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
            </div>
            {/* Mobile API Usage Display */}
            <div className="flex flex-col gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-650 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-brand shrink-0" />
                <span>{apiCallsToday}/50 AI calls today</span>
              </div>
              <p className="text-[10px] text-slate-405 dark:text-slate-500 leading-normal">
                This limit keeps InterviewMate sustainable for everyone. Resets daily at midnight.
              </p>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                toggleTheme();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              {isDarkMode ? <Sun className="h-5 w-5 text-slate-400" /> : <Moon className="h-5 w-5 text-slate-400" />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <Link
              to="/onboarding"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-left"
            >
              <LogOut className="h-5 w-5" />
              Log out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
