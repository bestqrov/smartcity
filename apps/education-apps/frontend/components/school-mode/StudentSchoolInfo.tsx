'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { updateStudent } from '@/lib/services/students';
import { DOCUMENT_CHECKLIST, isPrescolaire } from '@/lib/schoolLevels';
import type { Student, StudentFormData, StudentSchoolFields } from '@/types';

type Field = { key: keyof StudentSchoolFields | 'healthNotes' | 'massarNumber'; label: string; ltr?: boolean; options?: [string, string][] };

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Enum fields use the values the student update endpoint accepts.
const SECTIONS: { title: string; fields: Field[] }[] = [
    {
        title: 'Identité',
        fields: [
            { key: 'nameAr', label: 'Prénom (arabe)' },
            { key: 'surnameAr', label: 'Nom (arabe)' },
            { key: 'gender', label: 'Sexe', options: [['M', 'Garçon'], ['F', 'Fille']] },
            { key: 'nationality', label: 'Nationalité' },
            { key: 'massarNumber', label: 'Code Massar', ltr: true },
            { key: 'schoolYear', label: 'Année scolaire', ltr: true },
            { key: 'enrollmentKind', label: "Type d'inscription", options: [['NEW', 'Nouvelle inscription'], ['RETURNING', 'Réinscription']] },
        ],
    },
    {
        title: 'Parents',
        fields: [
            { key: 'fatherCin', label: 'CIN du père', ltr: true },
            { key: 'fatherPhone', label: 'Téléphone du père', ltr: true },
            { key: 'fatherJob', label: 'Profession du père' },
            { key: 'motherCin', label: 'CIN de la mère', ltr: true },
            { key: 'motherPhone', label: 'Téléphone de la mère', ltr: true },
            { key: 'motherJob', label: 'Profession de la mère' },
            { key: 'payer', label: 'Responsable du paiement', options: [['FATHER', 'Père'], ['MOTHER', 'Mère'], ['GUARDIAN', 'Tuteur légal']] },
            { key: 'emergencyName', label: "Contact d'urgence (nom)" },
            { key: 'emergencyPhone', label: "Contact d'urgence (téléphone)", ltr: true },
        ],
    },
    {
        title: 'Santé',
        fields: [
            { key: 'bloodGroup', label: 'Groupe sanguin', ltr: true, options: BLOOD_GROUPS.map((g) => [g, g]) },
            { key: 'healthNotes', label: 'Allergies' },
            { key: 'chronicDiseases', label: 'Maladies chroniques' },
            { key: 'medications', label: 'Médicaments' },
        ],
    },
];
const FIELDS = SECTIONS.flatMap((s) => s.fields);

/** Private school fields of the student file (Informations tab), shown and edited section by section. */
export default function StudentSchoolInfo({ student, onSaved }: { student: Student; onSaved: (s: Student) => void }) {
    const { tr } = useI18n();
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [careConsent, setCareConsent] = useState(false);
    const [documents, setDocuments] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const docs = DOCUMENT_CHECKLIST.filter((d) => !d.prescolaireOnly || isPrescolaire(student.schoolLevel));

    const open = () => {
        setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(student[f.key] ?? '')])));
        setCareConsent(!!student.careConsent);
        setDocuments(student.documents ?? []);
        setError('');
        setEdit(true);
    };
    const save = async () => {
        setError('');
        setSaving(true);
        try {
            // An emptied choice is sent as null: the endpoint rejects '' for its enum fields.
            const body: Record<string, unknown> = { careConsent, documents };
            for (const f of FIELDS) {
                const v = (form[f.key] ?? '').trim();
                body[f.key] = f.options && !v ? null : v;
            }
            onSaved(await updateStudent(student.id, body as Partial<StudentFormData>));
            setEdit(false);
        } catch (e) {
            setError(describeApiError(e, tr, "Échec de l'enregistrement"));
        } finally {
            setSaving(false);
        }
    };

    const display = (f: Field) => {
        const raw = student[f.key];
        if (raw === null || raw === undefined || raw === '') return '—';
        const v = String(raw);
        const label = f.options?.find(([k]) => k === v)?.[1];
        if (label && label !== v) return tr(label);
        return f.ltr ? <bdi dir="ltr">{v}</bdi> : v;
    };
    const input = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900';

    return (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {SECTIONS.map((s) => (
                <section key={s.title}>
                    <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{tr(s.title)}</h3>
                    <dl className="grid gap-3 sm:grid-cols-2">
                        {s.fields.map((f) => (
                            <div key={f.key}>
                                <dt className="text-xs text-slate-500">{tr(f.label)}</dt>
                                {edit ? (
                                    f.options ? (
                                        <select aria-label={tr(f.label)} dir={f.ltr ? 'ltr' : undefined} className={`${input} text-start`} value={form[f.key] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}>
                                            <option value="">—</option>
                                            {f.options.map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
                                        </select>
                                    ) : (
                                        <input aria-label={tr(f.label)} dir={f.ltr ? 'ltr' : undefined} className={input} value={form[f.key] ?? ''} placeholder={f.key === 'schoolYear' ? '2026/2027' : undefined} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                                    )
                                ) : (
                                    <dd className="font-medium text-slate-900 dark:text-white">{display(f)}</dd>
                                )}
                            </div>
                        ))}
                    </dl>
                    {s.title === 'Santé' && (
                        <p className="mt-2 text-sm">
                            <span className="text-slate-500">{tr('Autorisation de soins')} : </span>
                            {edit
                                ? <input type="checkbox" aria-label={tr('Autorisation de soins')} checked={careConsent} onChange={(e) => setCareConsent(e.target.checked)} />
                                : <span className="font-medium">{student.careConsent === true ? tr('Oui') : student.careConsent === false ? tr('Non') : '—'}</span>}
                        </p>
                    )}
                </section>
            ))}
            <section>
                <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{tr('Documents remis')}</h3>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                    {docs.map((d) => {
                        const on = edit ? documents.includes(d.key) : (student.documents ?? []).includes(d.key);
                        return (
                            <li key={d.key}>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" disabled={!edit} checked={on} onChange={() => setDocuments((p) => (p.includes(d.key) ? p.filter((k) => k !== d.key) : [...p, d.key]))} />
                                    {tr(d.label)}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            </section>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            {edit ? (
                <div className="flex gap-2">
                    <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{tr('Enregistrer')}</button>
                    <button type="button" onClick={() => setEdit(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">{tr('Annuler')}</button>
                </div>
            ) : (
                <button type="button" onClick={open} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">{tr('Modifier')}</button>
            )}
        </div>
    );
}
