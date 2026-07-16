import React, { type HTMLAttributes } from 'react';

/* ═══════════════════════════════════════════════════════════
   Spinner
   ═══════════════════════════════════════════════════════════ */

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

const spinnerColors = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  current: 'text-current',
} as const;

export interface SpinnerProps extends HTMLAttributes<SVGSVGElement> {
  /** Size of the spinner */
  size?: keyof typeof spinnerSizes;
  /** Colour variant */
  color?: keyof typeof spinnerColors;
}

export function Spinner({
  size = 'md',
  color = 'primary',
  className = '',
  ...rest
}: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${spinnerSizes[size]} ${spinnerColors[color]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
      {...rest}
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

/* ═══════════════════════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════════════════════ */

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shape variant */
  variant?: 'rectangle' | 'circle' | 'text';
  /** Width (CSS value). Defaults depend on variant. */
  width?: string;
  /** Height (CSS value). Defaults depend on variant. */
  height?: string;
}

export function Skeleton({
  variant = 'rectangle',
  width,
  height,
  className = '',
  ...rest
}: SkeletonProps) {
  const defaults: Record<string, { w: string; h: string; rounded: string }> = {
    rectangle: { w: '100%', h: '1rem', rounded: 'rounded-md' },
    circle: { w: '2.5rem', h: '2.5rem', rounded: 'rounded-full' },
    text: { w: '100%', h: '0.75rem', rounded: 'rounded' },
  };

  const d = defaults[variant];

  return (
    <div
      className={[
        'animate-pulse bg-gray-200 dark:bg-gray-700',
        d.rounded,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: width ?? d.w,
        height: height ?? d.h,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   PageLoader
   ═══════════════════════════════════════════════════════════ */

export interface PageLoaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional message displayed below the spinner */
  message?: string;
  /** Spinner size */
  size?: keyof typeof spinnerSizes;
}

export function PageLoader({
  message,
  size = 'lg',
  className = '',
  ...rest
}: PageLoaderProps) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-4 ${className}`}
      {...rest}
    >
      <Spinner size={size} />
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
}
