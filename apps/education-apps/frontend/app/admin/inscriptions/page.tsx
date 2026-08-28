'use client';

import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';

export default function RegisterStudentPage() {
    return <SoutienInscriptionForm onSuccessRedirect="/admin/students" />;
}
