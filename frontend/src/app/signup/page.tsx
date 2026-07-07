"use client";

import { useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';
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
    <div className="flex min-h-screen items-center justify-center bg-radial from-neutral-50 to-[#f5f5f7] p-4 font-sans antialiased">
      <div className="w-full max-w-[420px]">
        {/* Logo Section */}
        <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6">
                <Image
                    src="/logo.png"
                    alt="AI Reliability Suite"
                    width={200}
                    height={84}
                    priority
                    className="h-auto w-auto max-w-xs"
                />
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[#1d1d1f]">
                Join AI Reliability Suite
            </h1>
            <p className="mt-2 text-[14px] text-[#6e6e73]">
                Create a new developer account.
            </p>
        </div>

        {/* Form Section */}
        <div className="rounded-3xl border border-black/[0.04] bg-white/70 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
            {error && (
              <div className="mb-5 rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-600 text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#1d1d1f]">Full Name</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-white/50 border border-neutral-200/80 px-4 py-3 text-sm text-[#1d1d1f] placeholder-neutral-400 focus:border-[#0071e3] focus:outline-none focus:ring-4 focus:ring-[#0071e3]/10 transition-all duration-200 font-normal"
                  placeholder="Steve Jobs"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#1d1d1f]">Email Address</label>
                <input
                  type="email"
                  className="w-full rounded-xl bg-white/50 border border-neutral-200/80 px-4 py-3 text-sm text-[#1d1d1f] placeholder-neutral-400 focus:border-[#0071e3] focus:outline-none focus:ring-4 focus:ring-[#0071e3]/10 transition-all duration-200 font-normal"
                  placeholder="username@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[#1d1d1f]">Password</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-white/50 border border-neutral-200/80 px-4 py-3 text-sm text-[#1d1d1f] focus:border-[#0071e3] focus:outline-none focus:ring-4 focus:ring-[#0071e3]/10 transition-all duration-200 font-normal"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className={cn(
                    "mt-2 w-full rounded-xl bg-[#0071e3] py-3 text-sm font-semibold text-white hover:bg-[#0077ed] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#0071e3]/20 transition-all duration-150 cursor-pointer shadow-sm shadow-blue-500/10",
                    loading && "opacity-70 cursor-not-allowed"
                )}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
        </div>

        <p className="mt-8 text-center text-xs text-[#6e6e73]">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#0071e3] hover:underline">
                Sign in
            </Link>
        </p>
      </div>
    </div>
  );
}
