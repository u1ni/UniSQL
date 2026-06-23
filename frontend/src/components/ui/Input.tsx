'use client';

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconRight,
      wrapperClassName = '',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--text-secondary)] select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-2.5 flex items-center text-[var(--text-muted)] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-9 text-sm
              bg-[var(--bg)] text-[var(--text)]
              border rounded-lg
              placeholder:text-[var(--text-muted)]
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50 focus:border-[var(--accent)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                error
                  ? 'border-[var(--error)] focus:ring-[var(--error)] focus:border-[var(--error)]'
                  : 'border-[var(--border)] hover:border-[var(--text-muted)]'
              }
              ${className}
            `}
            style={{ 
              paddingLeft: icon ? '3rem' : '0.75rem',
              paddingRight: iconRight ? '3rem' : '0.75rem' 
            }}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-2.5 flex items-center text-[var(--text-muted)]">
              {iconRight}
            </span>
          )}
        </div>
        {error && (
          <span className="text-xs text-[var(--error)] animate-slide-in-top">
            {error}
          </span>
        )}
        {hint && !error && (
          <span className="text-xs text-[var(--text-muted)]">{hint}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
