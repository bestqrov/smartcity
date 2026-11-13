import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    isLoading?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export default function Button({
    children,
    variant = 'primary',
    isLoading = false,
    size = 'md',
    className = '',
    disabled,
    ...props
}: ButtonProps) {

    const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary: "bg-vib-ink text-white hover:bg-gray-800 focus:ring-vib-indigo dark:bg-white dark:text-vib-ink dark:hover:bg-gray-200",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15",
        outline: "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 focus:ring-gray-500 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10",
        ghost: "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-500 dark:text-gray-200 dark:hover:bg-white/10",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}
