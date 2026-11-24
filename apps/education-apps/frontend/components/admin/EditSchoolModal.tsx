'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE, type InstitutionType } from '@/lib/institutionTypes';
import { apiErrorMessage } from '@/lib/services/packs';
import { resetSchoolOwnerPassword, updateSchoolByAdmin, type AdminSchoolUpdate, type SchoolListItem } from '@/lib/services/schools';

const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-300 mb-1';

const DAY = 24 * 60 * 60 * 1000;
// yyyy-mm-dd in the browser's time zone, for <input type="date">.
const toDateInput = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

// SUPER_ADMIN: edit a school (information, owner, type, trial end) and reset its owner's password.
export default function EditSchoolModal({ school, onClose, onSaved }: { school: SchoolListItem; onClose: () => void; onSaved: () => void }) {
    const initial = {
        name: school.name,
        ownerName: school.ownerName ?? '',
        ownerEmail: school.ownerEmail,
        ownerPhone: school.ownerPhone ?? '',
        city: school.city ?? '',
        address: school.address ?? '',
        institutionType: (school.institutionType ?? DEFAULT_INSTITUTION_TYPE) as InstitutionType,
        trialEnd: school.trialEndsAt ? toDateInput(new Date(school.trialEndsAt)) : '',
    };
    const [form, setForm] = useState(initial);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value }));

    // +N days from the current trial end when it is still ahead, otherwise from today.
    const extendTrial = (days: number) => {
        const current = form.trialEnd ? new Date(`${form.trialEnd}T23:59:59`) : null;
        const base = current && current.getTime() > Date.now() ? current : new Date();
        setForm((prev) => ({ ...prev, trialEnd: toDateInput(new Date(base.getTime() + days * DAY)) }));
    };

    const save = async () => {
        setError('');
        const changes: AdminSchoolUpdate = {};
        (['name', 'ownerName', 'ownerEmail', 'ownerPhone', 'city', 'address'] as const).forEach((key) => {
            if (form[key].trim() !== initial[key]) changes[key] = form[key].trim();
        });
        if (form.institutionType !== initial.institutionType) changes.institutionType = form.institutionType;
        if (form.trialEnd !== initial.trialEnd) changes.trialEndsAt = form.trialEnd ? new Date(`${form.trialEnd}T23:59:59`).toISOString() : null;
        if (password && password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        if (Object.keys(changes).length === 0 && !password) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            if (Object.keys(changes).length > 0) await updateSchoolByAdmin(school.id, changes);
            if (password) {
                await resetSchoolOwnerPassword(school.id, password);
                setPassword('');
            }
            onSaved();
            onClose();
        } catch (err) {
            const message = apiErrorMessage(err);
            setError(message === 'Email already exists' ? 'Cette adresse e-mail est déjà utilisée.' : message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Modifier — ${school.name}`}
            size="lg"
            footer={
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200">
                        Annuler
                    </button>
                    <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                        <span className={labelCls}>Nom de l'école</span>
                        <input value={form.name} onChange={set('name')} className={inputCls} required />
                    </label>
                    <label>
                        <span className={labelCls}>Nom du propriétaire</span>
                        <input value={form.ownerName} onChange={set('ownerName')} className={inputCls} />
                    </label>
                    <label>
                        <span className={labelCls}>Email du propriétaire (identifiant de connexion)</span>
                        <input type="email" value={form.ownerEmail} onChange={set('ownerEmail')} className={inputCls} dir="ltr" />
                    </label>
                    <label>
                        <span className={labelCls}>Téléphone du propriétaire</span>
                        <input type="tel" value={form.ownerPhone} onChange={set('ownerPhone')} className={inputCls} dir="ltr" />
                    </label>
                    <label>
                        <span className={labelCls}>Ville</span>
                        <input value={form.city} onChange={set('city')} className={inputCls} />
                    </label>
                    <label className="sm:col-span-2">
                        <span className={labelCls}>Adresse</span>
                        <input value={form.address} onChange={set('address')} className={inputCls} />
                    </label>
                    <label className="sm:col-span-2">
                        <span className={labelCls}>Type d'établissement</span>
                        <select value={form.institutionType} onChange={set('institutionType')} className={inputCls}>
                            {INSTITUTION_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {INSTITUTION_TYPE_LABELS[type]}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div>
                    <span className={labelCls}>Fin de l'essai</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={form.trialEnd} onChange={set('trialEnd')} className={`${inputCls} sm:w-auto`} aria-label="Fin de l'essai" />
                        {[7, 15, 30].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => extendTrial(days)}
                                className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-200"
                            >
                                +{days} jours
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <label>
                        <span className={labelCls}>Nouveau mot de passe du propriétaire (laisser vide pour ne pas changer)</span>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputCls}
                            minLength={8}
                        />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères. Il n'est plus affiché après l'enregistrement : transmettez-le au propriétaire.</p>
                </div>

                {error && (
                    <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}
            </div>
        </Modal>
    );
}
