import React, { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, placeholder, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <select
                    ref={ref}
                    className={`
            w-full px-3 py-2 border rounded-xl bg-white text-gray-900 shadow-sm
            dark:bg-white/5 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-vib-indigo focus:border-transparent
            disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-200 dark:border-white/10'}
            ${className}
          `}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${props.id}-error` : undefined}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p id={`${props.id}-error`} className="mt-1 text-sm text-red-600">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
