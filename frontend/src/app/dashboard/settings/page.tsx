"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { User, Lock, Mail, Save, Loader2 } from 'lucide-react';

// --- Components ---

function ProfileSettings() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState(''); // Read-only for now
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        // Fetch current user details
        // We probably need a /auth/me endpoint or stick it in AuthContext
        // For now, let's assume we can get it from localStorage or context if available.
        // Actually, we can decrypt the token or just fetch from the new /users/me endpoint if we made it return data?
        // Wait, I only made PUT /users/me. I should probably add GET /users/me or just set name empty initially.
        // Let's implement a quick fetch if possible, or just let them overwrite.
        // Better: let's try to fetch user info.
        // Since I didn't verify a GET /users/me, let's assume we start blank/placeholder or fetch from context.
        // For this demo, I'll just allow setting new values.
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        setIsLoading(true);

        if (password && password !== confirmPassword) {
            setErrorMsg("Passwords do not match");
            setIsLoading(false);
            return;
        }

        try {
            await api.put('/users/me', {
                full_name: name || undefined,
                password: password || undefined
            });
            setSuccessMsg("Profile updated successfully");
            setPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setErrorMsg(err.response?.data?.detail || "Failed to update profile");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-xl">
             <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User size={20} className="text-indigo-400"/> Personal Information
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
                 {/* Name */}
                <div>
                     <label className="block text-sm font-medium mb-1.5 text-foreground">Full Name</label>
                     <div className="relative">
                         <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                         <input 
                            type="text" 
                            className="bg-background border border-border rounded-md pl-10 pr-3 py-2 w-full text-sm focus:ring-1 focus:ring-primary"
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                         />
                     </div>
                </div>

                {/* Email (Read Only) */}
                <div>
                     <label className="block text-sm font-medium mb-1.5 text-foreground">Email Address</label>
                     <div className="relative opacity-60">
                         <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                         <input 
                            type="email" 
                            className="bg-background-subtle border border-border rounded-md pl-10 pr-3 py-2 w-full text-sm cursor-not-allowed"
                            placeholder="name@example.com"
                            disabled
                         />
                         <p className="text-[10px] text-muted-foreground mt-1">Email change is not supported yet.</p>
                     </div>
                </div>

                <div className="border-t border-border my-6"></div>

                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Lock size={20} className="text-indigo-400"/> Security
                </h2>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-sm font-medium mb-1.5 text-foreground">New Password</label>
                         <input 
                            type="password" 
                            className="bg-background border border-border rounded-md px-3 py-2 w-full text-sm focus:ring-1 focus:ring-primary"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                         />
                     </div>
                     <div>
                         <label className="block text-sm font-medium mb-1.5 text-foreground">Confirm Password</label>
                         <input 
                            type="password" 
                            className="bg-background border border-border rounded-md px-3 py-2 w-full text-sm focus:ring-1 focus:ring-primary"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                         />
                     </div>
                </div>

                {errorMsg && <div className="text-red-500 text-sm mt-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500"/>{errorMsg}</div>}
                {successMsg && <div className="text-emerald-500 text-sm mt-2 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>{successMsg}</div>}

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}

// --- Main Page ---

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'profile' | 'apikeys'>('profile');

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-background text-foreground overflow-hidden">
            <div className="px-8 py-6 border-b border-border">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground text-sm mt-1">Manage your account preferences.</p>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Navigation for Settings */}
                <div className="w-64 border-r border-border bg-background-subtle/10 p-6 flex-none">
                     <nav className="space-y-1">
                         <button 
                            onClick={() => setActiveTab('profile')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
                                activeTab === 'profile' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            }`}
                        >
                            <User size={16}/> Profile
                         </button>
                     </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                        {activeTab === 'profile' && <ProfileSettings />}
                    </div>
                </div>
            </div>
        </div>
    );
}
