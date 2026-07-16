import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      size = 'md',
      className = '',
      id,
      ...rest
    },
    ref,
  ) => {
    const sizeClasses = {
      sm: 'px-2.5 py-1.5 text-sm',
      md: 'px-3 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    };

    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full rounded-lg border bg-white transition-colors',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            error ? 'border-red-500' : 'border-gray-300',
            sizeClasses[size],
          ].join(' ')}
          {...rest}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
