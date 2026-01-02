"use client";

import { useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/signup', {
        email,
        full_name: fullName, 
        password
      });
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      <div className="w-full max-w-[400px] p-6">
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center text-center">
             <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-white"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-white uppercase" style={{ fontFamily: 'var(--font-mono)' }}>
                Join the Stack
            </h1>
            <p className="mt-2 text-sm text-gray-400">
                Already have an account? <Link href="/login" className="font-medium text-cyan-400 hover:text-cyan-300">Sign in</Link>
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
                <label className="text-sm font-medium text-gray-300">Full Name</label>
                <input
                  type="text"
                  className="w-full rounded bg-gray-800/50 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  className="w-full rounded bg-gray-800/50 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <input
                  type="password"
                  className="w-full rounded bg-gray-800/50 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className={cn(
                    "mt-4 w-full rounded bg-cyan-500 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors",
                    loading && "opacity-70 cursor-not-allowed"
                )}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}
