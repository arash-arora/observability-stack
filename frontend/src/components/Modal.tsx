"use client";

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ isOpen, onClose, children, width = 'max-w-7xl' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className={`relative w-full ${width} max-h-[90vh] bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-2xl flex flex-col overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4 z-10">
          <button 
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--accent)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
