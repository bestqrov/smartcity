'use client';

import { useState } from 'react';

export default function DebugPage() {
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const checkToken = () => {
        const token = localStorage.getItem('accessToken');
        addLog(token ? `Token found (length: ${token.length})` : 'No token found');
    };

    const testCreateTransaction = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const url = 'http://localhost:3000/transactions';
            addLog(`Sending POST to ${url}`);

            const payload = {
                type: 'EXPENSE',
                amount: 100,
                category: 'Debug',
                description: 'Debug Test',
                date: new Date().toISOString()
            };
            addLog(`Payload: ${JSON.stringify(payload)}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            addLog(`Response Status: ${response.status} ${response.statusText}`);

            const text = await response.text();
            addLog(`Response Body: ${text}`);

        } catch (error: any) {
            addLog(`ERROR: ${error.message}`);
        }
    };

    return (
        <div className="p-8 space-y-4">
            <h1 className="text-2xl font-bold">Diagnostic Tool</h1>
            <div className="flex gap-4">
                <button onClick={checkToken} className="px-4 py-2 bg-blue-500 text-white rounded">
                    Check Token
                </button>
                <button onClick={testCreateTransaction} className="px-4 py-2 bg-red-500 text-white rounded">
                    Test Create Transaction
                </button>
            </div>
            <div className="bg-gray-900 text-green-400 p-4 rounded h-96 overflow-auto font-mono text-sm whitespace-pre-wrap">
                {logs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
        </div>
    );
}
