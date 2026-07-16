import React, { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`flex flex-col gap-1.5 p-6 pb-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...rest }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`} {...rest}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}
