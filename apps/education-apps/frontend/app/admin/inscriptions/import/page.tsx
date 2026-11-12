// frontend/app/admin/inscriptions/import/page.tsx
'use client';

import StudentImportWizard from '@/components/import/StudentImportWizard';

export default function AdminStudentImportPage() {
    return <StudentImportWizard studentsPath="/admin/students" parentsPath="/admin/parents" />;
}
