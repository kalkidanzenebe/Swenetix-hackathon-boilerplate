import React, { useState } from 'react';
import { LayoutGrid, UserCheck, ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loginUserAsync, registerUserAsync, clearAuthError } from '../features/auth/authSlice';

export const AuthPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const toggleMode = (mode: boolean) => {
    setIsLogin(mode);
    dispatch(clearAuthError());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed || !password) return;

    if (isLogin) {
      dispatch(loginUserAsync({ displayName: trimmed, password }));
    } else {
      dispatch(registerUserAsync({ displayName: trimmed, password }));
    }
  };

  const handleQuickDemo = (name: string) => {
    dispatch(clearAuthError());
    dispatch(loginUserAsync({ displayName: name, password: 'Password123!' }))
      .unwrap()
      .catch(() => {
        dispatch(registerUserAsync({ displayName: name, password: 'Password123!' }));
      });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white-950 px-4 py-12">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-white-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-white-500/15 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-800/80 bg-white-900/80 p-8 shadow-2xl backdrop-blur-2xl">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          
          <h1 className="text-2xl font-bold tracking-tight text-white">
            TaskFlow
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-Time Multi-User Collaborative Kanban
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-white-950/60 p-1 border border-slate-800/80">
          <button
            type="button"
            onClick={() => toggleMode(true)}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              isLogin
                ? 'bg-white-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => toggleMode(false)}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              !isLogin
                ? 'bg-white-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Display Name
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Kalkidan"
                className="w-full rounded-xl border border-slate-700/80 bg-white-800/80 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700/80 bg-white-800/80 pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Must be at least 8 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/40 disabled:opacity-50 transition-all"
          >
            <span>{loading ? 'Processing...' : isLogin ? 'Sign In to Board' : 'Create Account'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Quick Demo Logins for Evaluators */}
        <div className="mt-8 border-t border-slate-800/80 pt-5">
          
         
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

