'use client';

import { useRouter } from 'next/navigation';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';
import AddStudentForm from '@/components/forms/AddStudentForm';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';

export default function RegisterStudentPage() {
    const router = useRouter();
    const { profile, loading } = useSchoolProfile();

    if (!loading && profile.institutionType === 'CRECHE') {
        return <AddStudentForm onSuccess={() => router.push('/admin/students')} />;
    }

    return <SoutienInscriptionForm onSuccessRedirect="/admin/students" />;
}
