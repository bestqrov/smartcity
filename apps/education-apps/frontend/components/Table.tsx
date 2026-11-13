import React from 'react';

export default function Table({ columns, data }: { columns: string[]; data: any[] }) {
    return (
        <table className="w-full border-collapse overflow-hidden rounded-2xl bg-white text-sm dark:bg-vib-card dark:text-gray-100">
            <thead>
                <tr>
                    {columns.map(c => <th key={c} className="border border-gray-100 bg-gray-50 p-2 text-left font-semibold text-gray-600 dark:border-white/5 dark:bg-white/5 dark:text-gray-300">{c}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.map((row, i) => (
                    <tr key={i} className="odd:bg-gray-50 dark:odd:bg-white/[0.03]">
                        {columns.map((c) => <td key={c} className="border border-gray-100 p-2 dark:border-white/5">{row[c] ?? '-'}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
