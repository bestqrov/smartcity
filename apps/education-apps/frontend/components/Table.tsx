import React from 'react';

export default function Table({ columns, data }: { columns: string[]; data: any[] }) {
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    {columns.map(c => <th key={c} className="border p-2 text-left">{c}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.map((row, i) => (
                    <tr key={i} className="odd:bg-gray-50">
                        {columns.map((c) => <td key={c} className="border p-2">{row[c] ?? '-'}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
