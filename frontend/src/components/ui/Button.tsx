'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm hover:shadow-md active:scale-[0.98]',
  secondary:
    'bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--text-muted)] active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text)] active:bg-[var(--surface-active)]',
  danger:
    'bg-[var(--error)] hover:bg-red-600 text-white shadow-sm hover:shadow-md active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-3 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        select-none whitespace-nowrap
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled || loading || false}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && (
        <span className="flex-shrink-0 flex items-center">{iconRight}</span>
      )}
    </button>
  );
}
