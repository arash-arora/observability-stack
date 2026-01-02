"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      
      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const { access_token } = res.data;
      const user = { id: 'userid', email: email }; 
      login(access_token, user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      <div className="w-full max-w-[400px] p-6">
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center text-center">
            {/* Gradient Logo */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-10 w-10 text-white"
                >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Observability Stack
            </h1>
            <p className="mt-2 text-sm text-gray-400">
                New to Observability Stack? <Link href="/signup" className="font-medium text-cyan-400 hover:text-cyan-300">Register</Link>
            </p>
        </div>

        {/* Form Section */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 shadow-2xl backdrop-blur-sm">
            {error && (
              <div className="mb-4 rounded bg-red-900/20 border border-red-900/50 p-3 text-sm text-red-200 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  className="w-full rounded bg-gray-800/50 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Password</label>
                </div>
                <input
                  type="password"
                  className="w-full rounded bg-gray-800/50 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                 <Link href="#" className="text-sm font-medium text-cyan-500 hover:text-cyan-400">
                    Forgot password?
                 </Link>
              </div>

              <button 
                type="submit" 
                className={cn(
                    "mt-2 w-full rounded bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors",
                    loading && "opacity-70 cursor-not-allowed"
                )}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}
