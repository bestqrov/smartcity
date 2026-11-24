'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { useI18n, appLocale } from '@/lib/i18n/I18nProvider';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { DOCUMENT_CHECKLIST, isPrescolaire } from '@/lib/schoolLevels';
import { levelLabel } from '@/lib/levels';
import { getStudentById } from '@/lib/services/students';

// Same approach as the report cards: everything but the dossier is hidden when printing.
const PRINT_CSS = `
@media print {
  body > *:not(#dossier-print-root) { display: none !important; }
  #dossier-print-root { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; }
  @page { size: A4 portrait; margin: 12mm; }
}
@media screen {
  #dossier-print-root { position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #e2e8f0; padding: 16px; }
  .dossier-page { max-width: 210mm; margin: 0 auto; background: #fff; padding: 12mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
}
#dossier-print-root { color: #0f172a; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; }
`;

// Authorized pickup lines are stored as "Nom (lien) — téléphone"; older crèche data used objects.
const pickupLine = (p: any): string =>
    typeof p === 'string' ? p : [p?.name, p?.relation ? `(${p.relation})` : '', p?.phone ? `— ${p.phone}` : ''].filter(Boolean).join(' ');

/** The inscription file handed to the parents, printed in the interface language. */
export default function StudentDossierPage() {
    const { tr } = useI18n();
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { profile } = useSchoolProfile();
    const [s, setS] = useState<any>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        getStudentById(id).then(setS).catch(() => setS(false));
    }, [id]);
    if (s === null) return <p className="p-6">{tr('Chargement…')}</p>;
    if (!s) return <p className="p-6">{tr('Élève introuvable')}</p>;
    if (!mounted) return null;

    const date = (v?: string) => (v ? new Date(v).toLocaleDateString(appLocale()) : '');
    const ltr = (v?: string | null) => (v ? <bdi dir="ltr">{v}</bdi> : null);
    const join = (parts: ReactNode[]) => {
        const kept = parts.filter(Boolean);
        return kept.length ? kept.map((p, i) => <span key={i}>{i > 0 && ' · '}{p}</span>) : null;
    };
    const row = (k: string, v?: ReactNode) => (
        <div className="flex gap-2 border-b border-dotted border-gray-300 py-1.5 text-sm">
            <dt className="w-48 shrink-0 font-semibold">{tr(k)}</dt>
            <dd>{v || '—'}</dd>
        </div>
    );
    const payer = s.payer === 'FATHER' ? tr('Père') : s.payer === 'MOTHER' ? tr('Mère') : s.payer === 'GUARDIAN' ? tr('Tuteur légal') : '';
    const docs = DOCUMENT_CHECKLIST.filter((d) => !d.prescolaireOnly || isPrescolaire(s.schoolLevel));
    const pickup: any[] = Array.isArray(s.authorizedPickup) ? s.authorizedPickup : [];
    const section = 'mt-5';
    const h2 = 'mb-1 border-b border-gray-900 pb-1 text-base font-bold';

    return createPortal(
        <div id="dossier-print-root">
            <style>{PRINT_CSS}</style>
            <div className="mb-3 flex justify-center gap-2 print:hidden">
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Printer size={16} />{tr('Imprimer / PDF')}</button>
                <button type="button" onClick={() => router.back()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700">{tr('Fermer')}</button>
            </div>
            <div className="dossier-page">
                <header className="flex items-center justify-between gap-4 border-b-2 border-gray-900 pb-4">
                    <div className="flex items-center gap-3">
                        {profile.logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.logo} alt="" className="h-16 w-16 object-contain" />
                        )}
                        <div>
                            <p className="text-xl font-black">{profile.schoolName}</p>
                            <p className="text-sm">{profile.address}{profile.phone && <> · {ltr(profile.phone)}</>}</p>
                        </div>
                    </div>
                    {s.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photo} alt="" className="h-24 w-20 rounded object-cover" />
                    )}
                </header>
                <h1 className="mt-5 text-center text-2xl font-black">{tr("Dossier d'inscription")} {ltr(s.schoolYear)}</h1>
                {s.enrollmentKind && <p className="text-center text-sm">{s.enrollmentKind === 'RETURNING' ? tr('Réinscription') : tr('Nouvelle inscription')}</p>}

                <section className={section}><h2 className={h2}>{tr('Élève')}</h2><dl>
                    {row('Nom et prénom', `${s.surname ?? ''} ${s.name ?? ''}`.trim())}
                    {row('Nom et prénom (arabe)', s.surnameAr || s.nameAr ? <bdi dir="rtl">{[s.surnameAr, s.nameAr].filter(Boolean).join(' ')}</bdi> : null)}
                    {row('Sexe', s.gender === 'M' ? tr('Garçon') : s.gender === 'F' ? tr('Fille') : '')}
                    {row('Date et lieu de naissance', join([date(s.birthDate), s.birthPlace]))}
                    {row('Nationalité', s.nationality ? tr(s.nationality) : '')}
                    {row('Code Massar', ltr(s.massarNumber))}
                    {row('Niveau', tr(levelLabel(s.schoolLevel)))}
                    {row('Adresse', s.address)}
                </dl></section>

                <section className={section}><h2 className={h2}>{tr('Parents')}</h2><dl>
                    {row('Père', join([s.fatherName, ltr(s.fatherCin), ltr(s.fatherPhone), s.fatherJob]))}
                    {row('Mère', join([s.motherName, ltr(s.motherCin), ltr(s.motherPhone), s.motherJob]))}
                    {row('Tuteur légal', join([s.parentName, s.parentRelation, ltr(s.parentPhone)]))}
                    {row('Responsable du paiement', payer)}
                    {row("Contact d'urgence", join([s.emergencyName, ltr(s.emergencyPhone)]))}
                    {row("Personnes autorisées à récupérer l'enfant", pickup.length ? <ul>{pickup.map((p, i) => <li key={i}>{pickupLine(p)}</li>)}</ul> : null)}
                </dl></section>

                <section className={section}><h2 className={h2}>{tr('Santé')}</h2><dl>
                    {row('Groupe sanguin', ltr(s.bloodGroup))}
                    {row('Allergies', s.healthNotes)}
                    {row('Maladies chroniques', s.chronicDiseases)}
                    {row('Médicaments', s.medications)}
                    {row('Autorisation de soins', s.careConsent === true ? tr('Oui') : s.careConsent === false ? tr('Non') : '')}
                </dl></section>

                <section className={section}><h2 className={h2}>{tr('Documents remis')}</h2>
                    <ul className="grid grid-cols-2 gap-1 text-sm">
                        {docs.map((d) => <li key={d.key}>{(s.documents ?? []).includes(d.key) ? '☑' : '☐'} {tr(d.label)}</li>)}
                    </ul>
                </section>

                <footer className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
                    <div>{tr('Signature du parent')}<div className="mt-16 border-t border-gray-400" /></div>
                    <div>{tr("Cachet de l'établissement")}<div className="mt-16 border-t border-gray-400" /></div>
                </footer>
            </div>
        </div>,
        document.body,
    );
}
