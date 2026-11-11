'use client';

import { useEffect, useState } from 'react';
import AgentReportView from '@/components/agent/AgentReportView';
import { apiErrorMessage } from '@/lib/services/packs';
import { getMyAgentReport, type AgentReport } from '@/lib/services/salesAgents';

export default function AgentHomePage() {
    const [report, setReport] = useState<AgentReport | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getMyAgentReport()
            .then(setReport)
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    if (error) return <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>;
    if (!report) return <p className="text-gray-500">Chargement…</p>;

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">Bonjour {report.agent.name}</h1>
            <AgentReportView report={report} />
        </div>
    );
}
