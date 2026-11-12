'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';

export default function SecretaryInscriptionsPage() {
    return (
        <>
            <div className="mb-4 flex justify-end">
                <Link
                    href="/secretary/inscriptions/import"
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                >
                    <FileSpreadsheet className="h-4 w-4" /> Importer une liste Excel
                </Link>
            </div>
            <SoutienInscriptionForm onSuccessRedirect="/secretary" />
        </>
    );
}
