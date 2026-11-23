'use client';

import { useCallback, useEffect, useState } from 'react';
import AgentReportView from '@/components/agent/AgentReportView';
import DeclarePaymentModal from '@/components/agent/DeclarePaymentModal';
import { DashboardBanner } from '@/components/dashboard/DashboardShell';
import { apiErrorMessage } from '@/lib/services/packs';
import { getMyAgentReport, type AgentReport } from '@/lib/services/salesAgents';
import { getMyDeclarations, type PaymentDeclaration } from '@/lib/services/paymentDeclarations';
import { useAgentPrefs } from '@/lib/agent/prefs';
import { localizeApiError } from '@/lib/agent/messages';

type DeclaringSchool = { id: string; name: string; packName: string | null };

export default function AgentHomePage() {
    const { lang, m, section } = useAgentPrefs();
    const [report, setReport] = useState<AgentReport | null>(null);
    const [declarations, setDeclarations] = useState<PaymentDeclaration[]>([]);
    const [declaring, setDeclaring] = useState<DeclaringSchool | null>(null);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    // Declarations are optional for the dashboard: a failure there must not hide the report.
    const loadDeclarations = useCallback(() => getMyDeclarations().then(setDeclarations).catch(() => {}), []);

    useEffect(() => {
        getMyAgentReport()
            .then(setReport)
            .catch((err) => setError(apiErrorMessage(err)));
        loadDeclarations();
    }, [loadDeclarations]);

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
            <DashboardBanner
                title={m.banner_title}
                subtitle={
                    <>
                        {m.hello(report.agent.name)} · {m.code} <span className="font-mono font-bold">{report.agent.code}</span>
                    </>
                }
            />
            {notice && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {notice}
                </p>
            )}
            <AgentReportView
                report={report}
                ratesTitle={m.my_rates}
                lang={lang}
                m={m}
                focus={section}
                declarations={declarations}
                onDeclare={(school) => {
                    setNotice('');
                    setDeclaring(school);
                }}
            />
            {declaring && (
                <DeclarePaymentModal
                    school={declaring}
                    rateTable={report.rateTable}
                    m={m}
                    onClose={() => setDeclaring(null)}
                    onDone={() => {
                        setDeclaring(null);
                        setNotice(m.decl_sent);
                        loadDeclarations();
                    }}
                />
            )}
        </div>
    );
}
