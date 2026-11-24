'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { hasFeature } from '@/lib/packs';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { DOCUMENT_CHECKLIST, isPrescolaire, levelsOfCycles } from '@/lib/schoolLevels';
import { getTuitionGrid, registerSchoolStudent, type InscriptionSummary, type TuitionRow } from '@/lib/services/schoolMode';
import { groupsService } from '@/lib/services/groups';
import { getStudents } from '@/lib/services/students';
import { transportService } from '@/lib/services/transport';
import type { Student } from '@/types';

type Pickup = { name: string; phone: string; relation: string };
const MAX_PICKUP = 10;
const STEPS = ['Élève', 'Scolarité', 'Parents', 'Santé', 'Services et frais'];
const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white';
const label = 'mb-1 block text-xs font-bold text-gray-600 dark:text-gray-300';
const currentYear = () => {
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}/${start + 1}`;
};

export default function SchoolInscriptionForm({ cycles, schoolYear, studentsPath }: { cycles: string[]; schoolYear: string | null; studentsPath: string }) {
    const { tr } = useI18n();
    const { profile } = useSchoolProfile();
    const transportOn = hasFeature(profile.features, 'TRANSPORT');
    const levels = levelsOfCycles(cycles);
    const [step, setStep] = useState(0);
    const [f, setF] = useState<Record<string, any>>({ nationality: 'Marocaine', enrollmentKind: 'NEW', payer: 'FATHER', careConsent: true, documents: [], schoolYear: schoolYear ?? currentYear(), siblingDiscount: 0, method: 'CASH' });
    const [pickup, setPickup] = useState<Pickup[]>([]);
    const [grid, setGrid] = useState<TuitionRow[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [siblings, setSiblings] = useState<string[]>([]);
    const [fees, setFees] = useState({ inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ id: string; name: string; summary: InscriptionSummary; transportError?: string } | null>(null);
    const set = (key: string, value: unknown) => setF((prev) => ({ ...prev, [key]: value }));

    useEffect(() => {
        getTuitionGrid().then(setGrid).catch(() => setGrid([]));
        groupsService.getAll().then(setGroups).catch(() => setGroups([]));
        if (transportOn) transportService.routes.list().then(setRoutes).catch(() => setRoutes([]));
    }, [transportOn]);

    // Level change: take the grid amounts (the office can still type others).
    useEffect(() => {
        const row = grid.find((r) => r.level === f.level);
        setFees({ inscriptionFee: row?.inscriptionFee ?? 0, monthlyFee: row?.monthlyFee ?? 0, insuranceFee: row?.insuranceFee ?? 0 });
    }, [f.level, grid]);

    // Same guardian phone as an active student: suggest the sibling discount.
    // Debounced while typing; no request when the phone's last 9 digits did not change.
    const lastSiblingPhone = useRef('');
    useEffect(() => {
        const phone = String(f.parentPhone ?? '').replace(/\D/g, '').slice(-9);
        if (phone.length < 9) {
            lastSiblingPhone.current = '';
            setSiblings([]);
            return;
        }
        if (phone === lastSiblingPhone.current) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            getStudents()
                .then((list: Student[]) => {
                    if (cancelled) return;
                    lastSiblingPhone.current = phone;
                    setSiblings(list.filter((s) => s.active !== false && String(s.parentPhone ?? '').replace(/\D/g, '').endsWith(phone)).map((s) => `${s.name} ${s.surname}`));
                })
                .catch(() => {
                    if (!cancelled) setSiblings([]);
                });
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [f.parentPhone]);

    const monthly = Math.round(fees.monthlyFee * (100 - Number(f.siblingDiscount)) ) / 100;
    const firstDue = fees.inscriptionFee + fees.insuranceFee + monthly;
    const levelGroups = useMemo(() => groups.filter((g) => !f.level || !g.level || String(g.level).toUpperCase() === f.level || String(g.level).toLowerCase().startsWith(f.level.startsWith('PS') ? 'pres' : f.level.startsWith('P') ? 'prim' : f.level.startsWith('C') ? 'col' : 'lyc')), [groups, f.level]);
    const route = routes.find((r) => r.id === f.routeId);
    const docs = DOCUMENT_CHECKLIST.filter((d) => !d.prescolaireOnly || isPrescolaire(f.level));

    const overpaid = Number(f.amountPaid || 0) > Math.round(firstDue * 100) / 100;
    // Pickup people travel as one line each: « Nom (lien) — téléphone ».
    const pickupLines = () =>
        pickup
            .filter((p) => p.name.trim())
            .slice(0, MAX_PICKUP)
            .map((p) => [p.name.trim(), p.relation.trim() ? `(${p.relation.trim()})` : '', p.phone.trim() ? `— ${p.phone.trim()}` : ''].filter(Boolean).join(' '));

    const submit = async () => {
        if (busy) return;
        setError('');
        if (!f.name?.trim() || !f.surname?.trim()) return setStep(0), setError(tr('Le prénom et le nom sont obligatoires'));
        if (!f.level) return setStep(1), setError(tr('Choisissez le niveau'));
        if (overpaid) return setError(tr('Le montant dépasse les frais et le premier mois : encaissez les mois suivants depuis « Mensualités ».'));
        setBusy(true);
        try {
            const result = await registerSchoolStudent({
                ...f,
                authorizedPickup: isPrescolaire(f.level) ? pickupLines() : undefined,
                fees,
                amountPaid: Number(f.amountPaid || 0),
                transport: f.routeId && f.stopId ? { routeId: f.routeId, stopId: f.stopId } : undefined,
            });
            setDone({ id: result.student.id, name: `${result.student.name} ${result.student.surname}`, summary: result.summary, transportError: result.transportError });
        } catch (e) {
            setError(describeApiError(e, tr, "L'inscription a échoué"));
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-vib-card">
                <CheckCircle2 className="mx-auto text-emerald-500" size={48} aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{tr('{name} est inscrit(e)', { name: done.name })}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {tr("Dû à l'inscription")} : <bdi dir="ltr">{done.summary.firstDue}</bdi> {tr('MAD')} · {tr('Payé')} : <bdi dir="ltr">{done.summary.paid}</bdi> {tr('MAD')} · {tr('Reste')} : <bdi dir="ltr">{done.summary.remaining}</bdi> {tr('MAD')}
                </p>
                {done.transportError && (
                    <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-start text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{tr("Élève inscrit, mais le transport n'a pas été créé : {reason}", { reason: tr(done.transportError) })}</span>
                    </p>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link href={`${studentsPath.replace(/\/students$/, '')}/students/${done.id}/dossier`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><Printer size={16} />{tr('Imprimer le dossier')}</Link>
                    {studentsPath.startsWith('/admin') && <Link href={`${studentsPath}/${done.id}`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">{tr('Voir la fiche')}</Link>}
                    <button type="button" onClick={() => { setDone(null); setF((p) => ({ nationality: 'Marocaine', enrollmentKind: 'NEW', payer: 'FATHER', careConsent: true, documents: [], schoolYear: p.schoolYear, siblingDiscount: 0, method: 'CASH' })); setPickup([]); setStep(0); }} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold dark:border-white/10">{tr('Nouvelle inscription')}</button>
                </div>
            </div>
        );
    }

    const field = (key: string, text: string, props: Record<string, any> = {}) => (
        <div><label className={label} htmlFor={`f-${key}`}>{tr(text)}</label><input id={`f-${key}`} className={input} value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} {...props} /></div>
    );

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm dark:bg-vib-card">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr("Dossier d'inscription")}</h1>
                <ol className="mt-4 flex flex-wrap gap-2" aria-label={tr('Étapes')}>
                    {STEPS.map((s, i) => (
                        <li key={s}><button type="button" onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined} className={`rounded-full px-3 py-1.5 text-xs font-bold ${step === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}>{i + 1}. {tr(s)}</button></li>
                    ))}
                </ol>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {step === 0 && (<>
                        {field('name', 'Prénom *', { required: true })}
                        {field('surname', 'Nom *', { required: true })}
                        {field('nameAr', 'Prénom (arabe)', { dir: 'rtl', lang: 'ar' })}
                        {field('surnameAr', 'Nom (arabe)', { dir: 'rtl', lang: 'ar' })}
                        <div><label className={label} htmlFor="f-gender">{tr('Sexe')}</label><select id="f-gender" className={input} value={f.gender ?? ''} onChange={(e) => set('gender', e.target.value || undefined)}><option value="">—</option><option value="M">{tr('Garçon')}</option><option value="F">{tr('Fille')}</option></select></div>
                        {field('birthDate', 'Date de naissance', { type: 'date' })}
                        {field('birthPlace', 'Lieu de naissance')}
                        {field('nationality', 'Nationalité')}
                        {field('massarNumber', 'Code Massar', { dir: 'ltr', placeholder: 'J130000001' })}
                        {field('address', 'Adresse')}
                    </>)}
                    {step === 1 && (<>
                        {field('schoolYear', 'Année scolaire', { dir: 'ltr', readOnly: true, title: tr('Définie dans les paramètres') })}
                        <div><label className={label} htmlFor="f-level">{tr('Niveau *')}</label><select id="f-level" className={input} value={f.level ?? ''} onChange={(e) => set('level', e.target.value)}><option value="">{tr('Choisir…')}</option>{levels.map((l) => <option key={l.code} value={l.code}>{tr(l.label)}</option>)}</select></div>
                        <div><label className={label} htmlFor="f-group">{tr('Groupe / classe')}</label><select id="f-group" className={input} value={f.groupId ?? ''} onChange={(e) => set('groupId', e.target.value || undefined)}><option value="">—</option>{levelGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                        <div><label className={label} htmlFor="f-kind">{tr('Type')}</label><select id="f-kind" className={input} value={f.enrollmentKind} onChange={(e) => set('enrollmentKind', e.target.value)}><option value="NEW">{tr('Nouvel élève')}</option><option value="RETURNING">{tr('Réinscription')}</option></select></div>
                        {field('previousSchool', 'École précédente')}
                    </>)}
                    {step === 2 && (<>
                        {field('fatherName', 'Nom du père')}{field('fatherCin', 'CIN du père', { dir: 'ltr' })}{field('fatherPhone', 'Téléphone du père', { type: 'tel', dir: 'ltr' })}{field('fatherJob', 'Profession du père')}
                        {field('motherName', 'Nom de la mère')}{field('motherCin', 'CIN de la mère', { dir: 'ltr' })}{field('motherPhone', 'Téléphone de la mère', { type: 'tel', dir: 'ltr' })}{field('motherJob', 'Profession de la mère')}
                        {field('parentName', 'Tuteur légal (nom)')}{field('parentRelation', 'Lien de parenté')}{field('parentPhone', 'Téléphone du tuteur (espace parents)', { type: 'tel', dir: 'ltr' })}
                        <div><label className={label} htmlFor="f-payer">{tr('Qui paie ?')}</label><select id="f-payer" className={input} value={f.payer} onChange={(e) => set('payer', e.target.value)}><option value="FATHER">{tr('Le père')}</option><option value="MOTHER">{tr('La mère')}</option><option value="GUARDIAN">{tr('Le tuteur')}</option></select></div>
                        {field('emergencyName', "Contact d'urgence (nom)")}{field('emergencyPhone', "Contact d'urgence (téléphone)", { type: 'tel', dir: 'ltr' })}
                    </>)}
                    {step === 3 && (<>
                        <div><label className={label} htmlFor="f-blood">{tr('Groupe sanguin')}</label><select id="f-blood" dir="ltr" className={`${input} text-start`} value={f.bloodGroup ?? ''} onChange={(e) => set('bloodGroup', e.target.value || undefined)}><option value="">—</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g}>{g}</option>)}</select></div>
                        {field('allergies', 'Allergies')}{field('chronicDiseases', 'Maladies chroniques')}{field('medications', 'Médicaments')}
                        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={!!f.careConsent} onChange={(e) => set('careConsent', e.target.checked)} />{tr("J'autorise l'établissement à faire donner les premiers soins et à appeler les urgences")}</label>
                        {isPrescolaire(f.level) && (
                            <div className="sm:col-span-2">
                                <p className={label}>{tr("Personnes autorisées à récupérer l'enfant")}</p>
                                {pickup.map((p, i) => (
                                    <div key={i} className="mb-2 grid grid-cols-3 gap-2">
                                        {(['name', 'phone', 'relation'] as const).map((k) => <input key={k} className={input} type={k === 'phone' ? 'tel' : 'text'} dir={k === 'phone' ? 'ltr' : undefined} aria-label={tr(k === 'name' ? 'Nom' : k === 'phone' ? 'Téléphone' : 'Lien')} placeholder={tr(k === 'name' ? 'Nom' : k === 'phone' ? 'Téléphone' : 'Lien')} value={p[k]} onChange={(e) => setPickup((l) => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />)}
                                    </div>
                                ))}
                                {pickup.length < MAX_PICKUP && <button type="button" onClick={() => setPickup((l) => [...l, { name: '', phone: '', relation: '' }])} className="text-sm font-bold text-indigo-600">{tr('+ Ajouter une personne')}</button>}
                            </div>
                        )}
                    </>)}
                    {step === 4 && (<>
                        {transportOn && (<>
                            <div><label className={label} htmlFor="f-route">{tr('Transport scolaire')}</label><select id="f-route" className={input} value={f.routeId ?? ''} onChange={(e) => { set('routeId', e.target.value || undefined); set('stopId', undefined); }}><option value="">{tr('Sans transport')}</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                            {route && <div><label className={label} htmlFor="f-stop">{tr('Arrêt')}</label><select id="f-stop" className={input} value={f.stopId ?? ''} onChange={(e) => set('stopId', e.target.value || undefined)}><option value="">{tr('Choisir…')}</option>{(route.stops ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
                        </>)}
                        {(['inscriptionFee', 'monthlyFee', 'insuranceFee'] as const).map((k) => (
                            <div key={k}><label className={label} htmlFor={`f-${k}`}>{tr(k === 'inscriptionFee' ? "Frais d'inscription (MAD)" : k === 'monthlyFee' ? 'Mensualité (MAD)' : 'Assurance (MAD)')}</label><input id={`f-${k}`} type="number" min="0" dir="ltr" className={input} value={fees[k]} onChange={(e) => setFees((x) => ({ ...x, [k]: Number(e.target.value || 0) }))} /></div>
                        ))}
                        <div><label className={label} htmlFor="f-disc">{tr('Réduction fratrie')}</label><select id="f-disc" className={input} value={f.siblingDiscount} onChange={(e) => set('siblingDiscount', Number(e.target.value))}>{[0, 10, 15, 20].map((p) => <option key={p} value={p}>{p} %</option>)}</select>{siblings.length > 0 && <p className="mt-1 text-xs text-amber-700">{tr('Frère/sœur déjà inscrit(e) : {names}', { names: siblings.join(', ') })}</p>}</div>
                        <div><label className={label} htmlFor="f-paid">{tr('Montant payé maintenant (MAD)')}</label><input id="f-paid" type="number" min="0" dir="ltr" className={input} value={f.amountPaid ?? ''} onChange={(e) => set('amountPaid', e.target.value)} />{overpaid && <p className="mt-1 text-xs font-semibold text-red-600">{tr('Au plus {max} MAD (frais + premier mois)', { max: Math.round(firstDue * 100) / 100 })}</p>}</div>
                        <div><label className={label} htmlFor="f-method">{tr('Mode de paiement')}</label><select id="f-method" className={input} value={f.method} onChange={(e) => set('method', e.target.value)}><option value="CASH">{tr('Espèces')}</option><option value="CHEQUE">{tr('Chèque')}</option><option value="VIREMENT">{tr('Virement')}</option><option value="CARD">{tr('Carte')}</option></select></div>
                        <fieldset className="sm:col-span-2"><legend className={label}>{tr('Documents remis')}</legend><div className="flex flex-wrap gap-3">{docs.map((d) => <label key={d.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.documents.includes(d.key)} onChange={(e) => set('documents', e.target.checked ? [...f.documents, d.key] : f.documents.filter((x: string) => x !== d.key))} />{tr(d.label)}</label>)}</div></fieldset>
                    </>)}
                </div>

                {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
                <div className="mt-6 flex justify-between gap-2">
                    <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 dark:border-white/10">{tr('Précédent')}</button>
                    {step < STEPS.length - 1
                        ? <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">{tr('Suivant')}</button>
                        : <button type="button" onClick={submit} disabled={busy || overpaid} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? tr('Enregistrement…') : tr("Enregistrer l'inscription")}</button>}
                </div>
            </div>

            <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm dark:bg-vib-card">
                <h2 className="font-bold text-gray-900 dark:text-white">{tr('Récapitulatif')}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><dt>{tr("Frais d'inscription")}</dt><dd><bdi dir="ltr">{fees.inscriptionFee}</bdi> {tr('MAD')}</dd></div>
                    <div className="flex justify-between"><dt>{tr('Assurance')}</dt><dd><bdi dir="ltr">{fees.insuranceFee}</bdi> {tr('MAD')}</dd></div>
                    <div className="flex justify-between"><dt>{tr('Mensualité')}{Number(f.siblingDiscount) ? <> (<bdi dir="ltr">−{f.siblingDiscount} %</bdi>)</> : ''}</dt><dd><bdi dir="ltr">{monthly}</bdi> {tr('MAD')}</dd></div>
                    <div className="flex justify-between border-t pt-2 font-bold"><dt>{tr("Dû à l'inscription")}</dt><dd><bdi dir="ltr">{firstDue}</bdi> {tr('MAD')}</dd></div>
                </dl>
                {f.level && !grid.find((r) => r.level === f.level && r.monthlyFee > 0) && <p className="mt-3 text-xs font-semibold text-amber-700">{tr('Aucun tarif pour ce niveau : renseignez-le dans Prix')}</p>}
            </aside>
        </div>
    );
}
