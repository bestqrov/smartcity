'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import SchoolInscriptionForm from '@/components/school-mode/SchoolInscriptionForm';
import { useSchoolCycles } from '@/hooks/useSchoolCycles';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';
import AddStudentForm from '@/components/forms/AddStudentForm';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { useI18n } from '@/lib/i18n/I18nProvider';

function ImportLink() {
    const { tr } = useI18n();
    return (
    <div className="mb-4 flex justify-end">
        <Link
            href="/admin/inscriptions/import"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
        >
            <FileSpreadsheet className="h-4 w-4" /> {tr('Importer une liste Excel')}
        </Link>
    </div>
    );
}

export default function RegisterStudentPage() {
    const router = useRouter();
    const { profile, loading } = useSchoolProfile();
    const { cycles, schoolYear, schoolMode, loading: cyclesLoading } = useSchoolCycles();

    if (!loading && !cyclesLoading && schoolMode) {
        return (
            <>
                <ImportLink />
                <SchoolInscriptionForm cycles={cycles} schoolYear={schoolYear} studentsPath="/admin/students" />
            </>
        );
    }

    if (!loading && profile.institutionType === 'CRECHE') {
        return (
            <>
                <ImportLink />
                <AddStudentForm onSuccess={() => router.push('/admin/students')} />
            </>
        );
    }

    return (
        <>
            <ImportLink />
            <SoutienInscriptionForm onSuccessRedirect="/admin/students" />
        </>
    );
}
