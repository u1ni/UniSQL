"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />
      
      <div 
        className={`relative w-full ${maxWidth} glass border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] mx-4 animate-slide-up`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-lg font-medium text-text">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-text/60 hover:text-text hover:bg-surface/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
        
        {footer && (
          <div className="p-4 border-t border-border/50 flex items-center justify-end gap-2 bg-surface/30 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
