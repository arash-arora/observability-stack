"use client";

import { useState } from 'react';
import api from '@/lib/api';
import { X } from 'lucide-react';

interface CreateProjectModalProps {
  orgId: string;
  onClose: () => void;
  onCreated: (project: any) => void;
}

export function CreateProjectModal({ orgId, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/management/projects', { 
          name, 
          organization_id: orgId 
      });
      onCreated(res.data);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Create Project</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
            </button>
        </div>
        
        <form onSubmit={handleSubmit}>
            <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">Name</label>
                <input 
                    type="text" 
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="My Project"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            
            <div className="flex justify-end gap-2">
                <button 
                    type="button" 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={loading}
                    className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Project'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
