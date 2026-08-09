import React, { type HTMLAttributes, type ReactNode } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary-50 text-primary-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
