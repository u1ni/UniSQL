"use client";

import React, { useEffect, useRef } from "react";
import { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Slight delay to prevent immediate close if trigger was a click
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  // Ensure menu stays within viewport
  const style: React.CSSProperties = {
    top: Math.min(y, window.innerHeight - (items.length * 40)),
    left: Math.min(x, window.innerWidth - 200),
  };

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-50 w-48 py-1 glass border border-border shadow-xl rounded-lg text-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="h-px bg-border/50 my-1" />;
        }
        
        const Icon = item.icon;
        
        return (
          <button
            key={item.id}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`
              w-full flex items-center px-3 py-1.5 text-left
              ${item.disabled 
                ? "text-text/30 cursor-not-allowed" 
                : "text-text/80 hover:text-text hover:bg-accent/10 focus:bg-accent/10 focus:outline-none"
              }
              transition-colors
            `}
          >
            {Icon && <Icon className="w-4 h-4 mr-2" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
