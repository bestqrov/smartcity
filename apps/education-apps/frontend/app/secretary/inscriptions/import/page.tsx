// frontend/app/secretary/inscriptions/import/page.tsx
'use client';

import StudentImportWizard from '@/components/import/StudentImportWizard';

export default function SecretaryStudentImportPage() {
    return <StudentImportWizard studentsPath="/secretary/students" />;
}
