'use client';

import { useEffect, useState } from 'react';
import AgentReportView from '@/components/agent/AgentReportView';
import { apiErrorMessage } from '@/lib/services/packs';
import { getMyAgentReport, type AgentReport } from '@/lib/services/salesAgents';
import { useAgentPrefs } from '@/lib/agent/prefs';
import { localizeApiError } from '@/lib/agent/messages';

export default function AgentHomePage() {
    const { lang, m, section } = useAgentPrefs();
    const [report, setReport] = useState<AgentReport | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getMyAgentReport()
            .then(setReport)
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    if (error)
        return (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                {localizeApiError(m, error)}
            </div>
        );
    if (!report)
        return (
            <p role="status" className="text-espresso-700 dark:text-espresso-200">
                {m.loading}
            </p>
        );

    return (
        <div className="space-y-4">
            <header className="flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl bg-espresso-800 px-5 py-3 text-center text-white shadow-sm dark:bg-espresso-ink sm:rounded-full">
                    <h1 className="text-lg font-extrabold sm:text-2xl">{m.banner_title}</h1>
                    <p className="mt-0.5 text-xs text-espresso-100 sm:text-sm">
                        {m.hello(report.agent.name)} · {m.code} <span className="font-mono font-bold">{report.agent.code}</span>
                    </p>
                </div>
            </header>
            <AgentReportView report={report} ratesTitle={m.my_rates} lang={lang} m={m} focus={section} />
        </div>
    );
}
