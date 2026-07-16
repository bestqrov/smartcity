import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

const variantClasses = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
  secondary:
    'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
  outline:
    'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500 disabled:text-gray-300 disabled:border-gray-200',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
} as const;

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: keyof typeof variantClasses;
  /** Size of the button */
  size?: keyof typeof sizeClasses;
  /** Show a loading spinner and disable the button */
  loading?: boolean;
  /** Icon element rendered before the label */
  iconLeft?: ReactNode;
  /** Icon element rendered after the label */
  iconRight?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  iconLeft,
  iconRight,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-colors duration-150 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <LoadingSpinner size={size} />
      ) : iconLeft ? (
        <span className="shrink-0">{iconLeft}</span>
      ) : null}

      {children}

      {!loading && iconRight ? (
        <span className="shrink-0">{iconRight}</span>
      ) : null}
    </button>
  );
}

/* ── tiny inline spinner ─────────────────────────────────── */

const spinnerSizes = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' } as const;

function LoadingSpinner({ size }: { size: keyof typeof spinnerSizes }) {
  return (
    <svg
      className={`animate-spin ${spinnerSizes[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
