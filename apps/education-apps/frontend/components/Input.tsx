import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode };
export default function Input({ label, className = '', ...props }: Props) {
    return (
        <div>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <input {...props} className={`w-full p-2 border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-vib-indigo dark:border-white/10 dark:bg-white/5 dark:text-gray-100 ${className}`} />
        </div>
    );
}
