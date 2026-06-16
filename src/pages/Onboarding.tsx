import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { Shield, BookOpen, Users, Check } from 'lucide-react';

const SKILLS_OPTIONS = ['DSA', 'System Design', 'React', 'Python', 'HR'];

export const Onboarding: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [role, setRole] = useState<'interviewer' | 'interviewee' | 'both'>('both');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || user?.displayName || '');
      setRole(profile.role || 'both');
      setSelectedSkills(profile.skills || []);
    }
  }, [profile, user]);

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (selectedSkills.length === 0) {
      setError('Please select at least one skill tag.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: name.trim(),
        role,
        skills: selectedSkills,
        onboarded: true
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout showNavbar={!!profile?.onboarded}>
      <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-xl space-y-8">
          <div className="text-center">
            <span className="text-sm font-bold tracking-wider text-brand uppercase">Setup your account</span>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-800 tracking-tight">Complete your profile</h1>
            <p className="mt-2 text-sm text-slate-500">
              Tell us about yourself so we can pair you with the best mock interview partners.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100">
                  {error}
                </div>
              )}

              {/* Display Name */}
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700">
                  What should we call you?
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Shreya Sharma"
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  What is your primary role?
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Interviewee Card */}
                  <button
                    type="button"
                    onClick={() => setRole('interviewee')}
                    className={`relative flex flex-col items-center justify-center rounded-xl border p-4 text-center cursor-pointer transition-all ${
                      role === 'interviewee'
                        ? 'border-brand bg-brand-light/30 ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <BookOpen className={`h-6 w-6 ${role === 'interviewee' ? 'text-brand' : 'text-slate-400'}`} />
                    <span className="mt-2 text-sm font-bold text-slate-800">Interviewee</span>
                    <span className="mt-1 text-xs text-slate-500">wants to practice answering</span>
                    {role === 'interviewee' && (
                      <span className="absolute top-2 right-2 rounded-full bg-brand p-0.5 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>

                  {/* Interviewer Card */}
                  <button
                    type="button"
                    onClick={() => setRole('interviewer')}
                    className={`relative flex flex-col items-center justify-center rounded-xl border p-4 text-center cursor-pointer transition-all ${
                      role === 'interviewer'
                        ? 'border-brand bg-brand-light/30 ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Shield className={`h-6 w-6 ${role === 'interviewer' ? 'text-brand' : 'text-slate-400'}`} />
                    <span className="mt-2 text-sm font-bold text-slate-800">Interviewer</span>
                    <span className="mt-1 text-xs text-slate-500">wants to evaluate & guide</span>
                    {role === 'interviewer' && (
                      <span className="absolute top-2 right-2 rounded-full bg-brand p-0.5 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>

                  {/* Both (Peer) Card */}
                  <button
                    type="button"
                    onClick={() => setRole('both')}
                    className={`relative flex flex-col items-center justify-center rounded-xl border p-4 text-center cursor-pointer transition-all ${
                      role === 'both'
                        ? 'border-brand bg-brand-light/30 ring-1 ring-brand'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Users className={`h-6 w-6 ${role === 'both' ? 'text-brand' : 'text-slate-400'}`} />
                    <span className="mt-2 text-sm font-bold text-slate-800">Peer Partner</span>
                    <span className="mt-1 text-xs text-slate-500">open to swapping roles</span>
                    {role === 'both' && (
                      <span className="absolute top-2 right-2 rounded-full bg-brand p-0.5 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Skills Tags */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Select your skills / interests
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {SKILLS_OPTIONS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand border-brand text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">Choose tags related to topics you want to practice or evaluate.</p>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand py-3 px-4 text-sm font-bold text-white hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Save and Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};
