"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Key, Copy, Check, Plus, User, Lock, Mail, Save, Loader2 } from 'lucide-react';

// --- Types ---
interface ApiKey {
  id: string;
  key: string;
  name: string;
  project_id: string;
  is_active: boolean;
  created_at: string;
}

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

function ApiKeySettings() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchKeys();
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/management/projects');
            setProjects(res.data);
            if (res.data.length > 0) setSelectedProjectId(res.data[0].id);
        } catch (err) {
            console.error('Failed to fetch projects');
        }
    };

    const fetchKeys = async () => {
        try {
            setLoading(true);
            const res = await api.get('/management/api-keys'); 
            setKeys(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProjectId) return;
        try {
            const res = await api.post('/management/api-keys', {
                name: newKeyName,
                project_id: selectedProjectId
            });
            setGeneratedKey(res.data.key); 
            setNewKeyName('');
            fetchKeys();
        } catch (err) {
            alert('Failed to generate API Key');
        }
    };

    const copyToClipboard = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div>
            <div className="mb-8 p-6 bg-background-subtle/30 border border-border rounded-lg">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus size={18} className="text-primary"/> Generate New Key
                </h2>
                
                {generatedKey ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 animate-in fade-in">
                        <div className="text-emerald-500 font-medium mb-2 text-sm">Success! Here is your new API Key. Copy it now, you won't see it again.</div>
                        <div className="flex items-center gap-2 bg-background border border-border rounded p-3 font-mono text-sm break-all">
                            <span>{generatedKey}</span>
                            <button onClick={copyToClipboard} className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-2 rounded hover:bg-muted">
                                {copied ? <Check size={16} className="text-emerald-500"/> : <Copy size={16}/>}
                            </button>
                        </div>
                        <button 
                            onClick={() => setGeneratedKey(null)} 
                            className="mt-4 text-xs font-medium bg-background border border-border px-3 py-1.5 rounded hover:bg-muted transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={createKey} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Key Name</label>
                            <input 
                                type="text" 
                                className="bg-background border border-border rounded-md px-3 py-2 w-full text-sm focus:ring-1 focus:ring-primary"
                                placeholder="e.g. Production Backend"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-64">
                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Project</label>
                            <select 
                                className="bg-background border border-border rounded-md px-3 py-2 w-full text-sm focus:ring-1 focus:ring-primary"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50 h-[38px]"
                            disabled={projects.length === 0}
                        >
                            Generate
                        </button>
                    </form>
                )}
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Key size={16} className="text-indigo-400"/> Active Keys
                    </h2>
                    <span className="text-xs text-muted-foreground">{keys.length} keys found</span>
                </div>
                
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/10 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Project</th>
                            <th className="px-4 py-3 font-medium">Prefix</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {keys.map(key => (
                            <tr key={key.id} className="hover:bg-muted/5 transition-colors">
                                <td className="px-4 py-3 font-medium">{key.name}</td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                    {projects.find(p => p.id === key.project_id)?.name || key.project_id.slice(0,8)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-mono text-[10px] bg-muted/50 rounded px-2 py-1 inline-block border border-border">
                                        {key.key ? (key.key.substring(0, 8) + '...') : '****************'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(key.created_at).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${key.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                        {key.is_active ? 'Active' : 'Revoked'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                    No API keys found. Generate one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
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
                <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and API access.</p>
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
                         <button 
                            onClick={() => setActiveTab('apikeys')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${
                                activeTab === 'apikeys' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            }`}
                        >
                            <Key size={16}/> API Keys
                         </button>
                     </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                        {activeTab === 'profile' && <ProfileSettings />}
                        {activeTab === 'apikeys' && <ApiKeySettings />}
                    </div>
                </div>
            </div>
        </div>
    );
}
