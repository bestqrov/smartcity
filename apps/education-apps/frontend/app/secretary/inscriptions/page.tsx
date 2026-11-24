'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import SchoolInscriptionForm from '@/components/school-mode/SchoolInscriptionForm';
import { useSchoolCycles } from '@/hooks/useSchoolCycles';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';

import { useI18n } from '@/lib/i18n/I18nProvider';
export default function SecretaryInscriptionsPage() {
    const { tr } = useI18n();
    const { cycles, schoolYear, schoolMode, loading: cyclesLoading } = useSchoolCycles();
    return (
        <>
            <div className="mb-4 flex justify-end">
                <Link
                    href="/secretary/inscriptions/import"
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                >
                    <FileSpreadsheet className="h-4 w-4" />{tr("Importer une liste Excel")}</Link>
            </div>
            {cyclesLoading ? null : schoolMode ? (
                <SchoolInscriptionForm cycles={cycles} schoolYear={schoolYear} studentsPath="/secretary/students" />
            ) : (
                <SoutienInscriptionForm onSuccessRedirect="/secretary" />
            )}
        </>
    );
}
