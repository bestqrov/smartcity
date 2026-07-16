'use client';

import React, {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
} as const;

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label rendered above the input */
  label?: string;
  /** Error message – also sets the error visual state */
  error?: string;
  /** Helper text shown below the input (hidden when error is present) */
  helperText?: string;
  /** Element rendered inside the input on the start side (respects RTL) */
  iconLeft?: ReactNode;
  /** Element rendered inside the input on the end side (respects RTL) */
  iconRight?: ReactNode;
  /** Size variant */
  size?: keyof typeof sizeClasses;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      iconLeft,
      iconRight,
      size = 'md',
      type = 'text',
      disabled,
      className = '',
      id,
      ...rest
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    const resolvedType = isPassword && showPassword ? 'text' : type;

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative flex items-center">
          {/* Left icon */}
          {iconLeft && (
            <span
              className={`pointer-events-none absolute start-3 text-gray-400 ${iconSizeClasses[size]}`}
            >
              {iconLeft}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            className={[
              'w-full rounded-lg border bg-white transition-colors duration-150',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400',
              'dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
              sizeClasses[size],
              iconLeft ? 'ps-10' : '',
              iconRight || isPassword ? 'pe-10' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            {...rest}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className={`absolute end-3 text-gray-400 hover:text-gray-600 ${iconSizeClasses[size]}`}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}

          {/* Right icon (non-password) */}
          {!isPassword && iconRight && (
            <span
              className={`pointer-events-none absolute end-3 text-gray-400 ${iconSizeClasses[size]}`}
            >
              {iconRight}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper text */}
        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

/* ── Inline SVG icons for password toggle ────────────────── */

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-full w-full"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-full w-full"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5 1.79 0 3.483-.44 4.968-1.217M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}
