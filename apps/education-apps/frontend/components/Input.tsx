import React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode };
export default function Input({ label, ...props }: Props) {
    return (
        <div>
            {label && <label className="block text-sm font-medium mb-1">{label}</label>}
            <input {...props} className="w-full p-2 border rounded" />
        </div>
    );
}
