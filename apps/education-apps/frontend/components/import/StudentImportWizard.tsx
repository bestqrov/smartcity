// frontend/components/import/StudentImportWizard.tsx
'use client';

// Four steps: file -> column mapping -> preview (server validation) -> report.
// The server re-validates on commit; the preview only shows what will happen.
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { autoMapping, fieldsFor, type ImportFieldKey } from '@/lib/import/fields';
import { downloadErrorRows, downloadTemplate, readSheet, type SheetData } from '@/lib/import/sheet';
import { apiErrorMessage } from '@/lib/services/packs';
import { studentLimitDetails } from '@/lib/services/subscription';
import { askForUpgrade } from '@/lib/packs/upgradeBus';
import { studentLimitMessage } from '@/lib/packs/limits';
import {
    commitStudentImport,
    validateStudentImport,
    type ImportCommitResult,
    type ImportRowInput,
    type ImportValidation,
} from '@/lib/services/studentsImport';

type Step = 'file' | 'mapping' | 'preview' | 'done';
type Filter = 'all' | 'valid' | 'duplicate' | 'error';

const MAX_ROWS = 1000;

const STATUS_STYLE = {
    valid: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    duplicate: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
};
const STATUS_LABEL = { valid: 'Valide', duplicate: 'Doublon', error: 'Erreur' };

const card = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6';
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';

interface Props {
    studentsPath: string; // where "Voir les élèves" goes after the import
    parentsPath?: string; // where the parents page lives; no link when absent
}

export default function StudentImportWizard({ studentsPath, parentsPath }: Props) {
    const { profile } = useSchoolProfile();
    const vocational = profile.institutionType === 'VOCATIONAL_TRAINING';
    const fields = useMemo(() => fieldsFor(profile.institutionType === 'CRECHE'), [profile.institutionType]);

    const [step, setStep] = useState<Step>('file');
    const [sheet, setSheet] = useState<SheetData | null>(null);
    const [fileName, setFileName] = useState('');
    const [mapping, setMapping] = useState<(ImportFieldKey | null)[]>([]);
    const [validation, setValidation] = useState<ImportValidation | null>(null);
    const [createGroups, setCreateGroups] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [result, setResult] = useState<ImportCommitResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [date1904, setDate1904] = useState(false);
    const running = useRef(false);
    const [error, setError] = useState('');

    const mapped = new Set(mapping.filter(Boolean));
    const namesMapped = (mapped.has('surname') && mapped.has('name')) || mapped.has('fullName');

    const buildRows = (): ImportRowInput[] =>
        (sheet?.rows ?? []).map((row) => {
            const out: ImportRowInput = { rowNumber: row.rowNumber };
            mapping.forEach((key, column) => {
                if (!key || !row.cells[column]) return;
                const cell = row.cells[column];
                // Mac Excel 1904 date system: serials are 1462 days behind the 1900 system.
                out[key] = date1904 && key === 'birthDate' && /^\d{5}$/.test(cell) ? String(Number(cell) + 1462) : cell;
            });
            return out;
        });

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setError('');
        setBusy(true);
        try {
            const data = await readSheet(file);
            if (data.rows.length === 0) throw new Error('Aucune ligne d’élève sous les en-têtes.');
            if (data.rows.length > MAX_ROWS) throw new Error(`Le fichier contient ${data.rows.length} lignes : maximum ${MAX_ROWS} par import. Découpez-le en plusieurs fichiers.`);
            setSheet(data);
            setDate1904(data.date1904);
            setFileName(file.name);
            setMapping(autoMapping(data.headers, fields.map((field) => field.key)));
            setStep('mapping');
        } catch (err: any) {
            setError(err?.message || 'Lecture du fichier impossible.');
        } finally {
            setBusy(false);
        }
    };

    const setColumn = (column: number, key: ImportFieldKey | null) =>
        setMapping((current) => current.map((value, i) => (i === column ? key : key && value === key ? null : value)));

    // Returns true when the preview was built; sets the error otherwise. Leaves `busy` to the caller.
    const validateRows = async (): Promise<boolean> => {
        try {
            setValidation(await validateStudentImport(buildRows()));
            setFilter('all');
            setStep('preview');
            return true;
        } catch (err) {
            setError(apiErrorMessage(err));
            return false;
        }
    };

    const runValidation = async () => {
        if (running.current) return;
        running.current = true;
        setError('');
        setBusy(true);
        try {
            await validateRows();
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    const overCapacity =
        validation && validation.capacity.remaining !== null && validation.counts.valid > validation.capacity.remaining;

    const openUpgrade = async () => {
        if (!validation || validation.capacity.limit === null || running.current) return;
        const upgraded = await askForUpgrade({
            limit: validation.capacity.limit,
            current: validation.capacity.current,
            adding: validation.counts.valid,
            packName: validation.capacity.packName,
        });
        if (upgraded) await runValidation();
    };

    // busy stays true for the whole run, including the upgrade dialog and the retry.
    const runCommit = async () => {
        if (running.current) return;
        running.current = true;
        setError('');
        setBusy(true);
        try {
            for (;;) {
                try {
                    setResult(await commitStudentImport(buildRows(), createGroups && !vocational));
                    setStep('done');
                    return;
                } catch (err) {
                    const details = studentLimitDetails(err);
                    if (!details) {
                        setError(apiErrorMessage(err));
                        return;
                    }
                    if (!(await askForUpgrade(details))) {
                        setError(studentLimitMessage(details));
                        return;
                    }
                    // Capacity changed: refresh the preview, then try again.
                    if (!(await validateRows())) return;
                }
            }
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    const restart = () => {
        setStep('file');
        setSheet(null);
        setValidation(null);
        setResult(null);
        setCreateGroups(false);
        setError('');
    };

    const cellsOf = (rowNumber: number) => sheet?.rows.find((row) => row.rowNumber === rowNumber)?.cells ?? [];
    const nameOf = (rowNumber: number) => {
        const row = validation?.rows.find((item) => item.rowNumber === rowNumber);
        return row ? `${row.data.surname} ${row.data.name}`.trim() || '—' : '—';
    };

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importer des élèves depuis Excel</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    Ajoutez toute votre liste d’élèves en une fois, sans les saisir un par un.
                </p>
            </div>

            <ol className="flex flex-wrap gap-2 text-xs font-semibold">
                {(['file', 'mapping', 'preview', 'done'] as Step[]).map((item, index) => (
                    <li
                        key={item}
                        className={`rounded-full px-3 py-1 ${
                            step === item ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {index + 1}. {['Fichier', 'Colonnes', 'Vérification', 'Résultat'][index]}
                    </li>
                ))}
            </ol>

            {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {step === 'file' && (
                <div className={`${card} space-y-5`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-white">1. Préparez votre fichier</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Utilisez votre fichier actuel ou notre modèle. Une ligne par élève, les en-têtes sur la première ligne.
                            </p>
                        </div>
                        <button type="button" className={secondaryBtn} onClick={() => downloadTemplate(fields)}>
                            <Download className="h-4 w-4" /> Télécharger le modèle
                        </button>
                    </div>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-400 dark:border-gray-600">
                        <Upload className="h-8 w-8 text-indigo-500" />
                        <span className="font-semibold text-gray-800 dark:text-gray-100">{busy ? 'Lecture…' : 'Choisir un fichier Excel ou CSV'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">.xlsx, .xls ou .csv · {MAX_ROWS} élèves maximum par import</span>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="sr-only"
                            disabled={busy}
                            onChange={(event) => {
                                onFile(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </label>
                </div>
            )}

            {step === 'mapping' && sheet && (
                <div className={`${card} space-y-4`}>
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">2. Associez les colonnes</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            <FileSpreadsheet className="me-1 inline h-4 w-4" />
                            {fileName} · {sheet.rows.length} ligne{sheet.rows.length > 1 ? 's' : ''}. Vérifiez à quel champ correspond chaque colonne.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {sheet.headers.map((header, column) => (
                            <div key={column} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={header}>
                                    {header || `Colonne ${column + 1}`}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    ex. : {sheet.rows.slice(0, 3).map((row) => row.cells[column]).filter(Boolean).join(' · ') || '—'}
                                </p>
                                <select
                                    value={mapping[column] ?? ''}
                                    onChange={(event) => setColumn(column, (event.target.value || null) as ImportFieldKey | null)}
                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    aria-label={`Champ pour la colonne ${header || column + 1}`}
                                >
                                    <option value="">Ignorer cette colonne</option>
                                    {fields.map((field) => (
                                        <option key={field.key} value={field.key}>
                                            {field.label} — {field.hint}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    {!namesMapped && (
                        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                            Associez « Nom » et « Prénom », ou « Nom complet », pour continuer.
                        </p>
                    )}
                    <div className="flex flex-wrap justify-between gap-2">
                        <button type="button" className={secondaryBtn} onClick={restart}>
                            Changer de fichier
                        </button>
                        <button type="button" className={primaryBtn} disabled={!namesMapped || busy} onClick={runValidation}>
                            {busy ? 'Vérification…' : 'Vérifier les lignes'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'preview' && validation && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {(['valid', 'duplicate', 'error'] as const).map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFilter(filter === status ? 'all' : status)}
                                aria-pressed={filter === status}
                                className={`rounded-xl p-3 text-start ${STATUS_STYLE[status]} ${filter === status ? 'ring-2 ring-indigo-500' : ''}`}
                            >
                                <span className="block text-2xl font-extrabold">{validation.counts[status]}</span>
                                <span className="text-xs font-semibold">{STATUS_LABEL[status]}{status !== 'valid' ? ' · ignoré' : ''}</span>
                            </button>
                        ))}
                    </div>

                    {validation.parents.toCreate + validation.parents.toLink > 0 && (
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            {validation.parents.toCreate} profil(s) parent seront créés, {validation.parents.toLink} élève(s) rattaché(s) à un parent existant.
                        </p>
                    )}

                    {overCapacity && (
                        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                {studentLimitMessage({
                                    limit: validation.capacity.limit!,
                                    current: validation.capacity.current,
                                    adding: validation.counts.valid,
                                    packName: validation.capacity.packName,
                                })}{' '}
                                Retirez des lignes du fichier ou passez à un pack supérieur.
                            </span>
                            <button type="button" className={primaryBtn} onClick={openUpgrade}>
                                Voir les packs
                            </button>
                        </div>
                    )}

                    {validation.missingGroups.length > 0 && (
                        <div className={`${card} space-y-2`}>
                            <p className="text-sm text-gray-800 dark:text-gray-100">
                                Ces groupes n’existent pas encore : <strong>{validation.missingGroups.join(', ')}</strong>
                            </p>
                            {vocational ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Créez les groupes de formation depuis la page Groupes.</p>
                            ) : (
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    <input type="checkbox" checked={createGroups} onChange={(event) => setCreateGroups(event.target.checked)} className="h-4 w-4" />
                                    Créer ces groupes automatiquement
                                </label>
                            )}
                            {!createGroups && !vocational && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Sinon, ces élèves seront créés sans groupe.</p>
                            )}
                        </div>
                    )}

                    <div className={`${card} p-0 sm:p-0`}>
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {validation.rows
                                .filter((row) => filter === 'all' || row.status === filter)
                                .map((row) => (
                                    <li key={row.rowNumber} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-4">
                                        <span className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400">Ligne {row.rowNumber}</span>
                                        <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}>
                                            {STATUS_LABEL[row.status]}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {nameOf(row.rowNumber)}
                                                {row.group && <span className="ms-2 text-xs text-gray-500 dark:text-gray-400">· {row.group}</span>}
                                            </p>
                                            {row.errors.map((message) => (
                                                <p key={message} className="text-xs text-red-600 dark:text-red-300">{message}</p>
                                            ))}
                                            {row.warnings.map((message) => (
                                                <p key={message} className="text-xs text-amber-700 dark:text-amber-300">{message}</p>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </div>

                    <div className="flex flex-wrap justify-between gap-2">
                        <button type="button" className={secondaryBtn} onClick={() => setStep('mapping')}>
                            Modifier les colonnes
                        </button>
                        <button
                            type="button"
                            className={primaryBtn}
                            disabled={busy || validation.counts.valid === 0 || !!overCapacity}
                            onClick={runCommit}
                        >
                            {busy ? 'Import en cours…' : `Importer ${validation.counts.valid} élève${validation.counts.valid > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && result && sheet && (
                <div className={`${card} space-y-4`}>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" /> Import terminé
                    </div>
                    <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-100">
                        <li><CheckCircle2 className="me-1 inline h-4 w-4 text-emerald-500" />{result.counts.created} élève(s) créé(s)</li>
                        <li><AlertTriangle className="me-1 inline h-4 w-4 text-amber-500" />{result.counts.duplicate} doublon(s) ignoré(s)</li>
                        <li><XCircle className="me-1 inline h-4 w-4 text-red-500" />{result.counts.error} ligne(s) en erreur</li>
                        <li>{result.parents.created} profil(s) parent créé(s)</li>
                        {result.createdGroups.length > 0 && <li>Groupes créés : {result.createdGroups.join(', ')}</li>}
                    </ul>
                    {parentsPath && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Créez les liens d’accès des parents depuis la page Parents.{' '}
                            <Link href={parentsPath} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
                                Ouvrir la page Parents
                            </Link>
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {result.counts.error > 0 && (
                            <button
                                type="button"
                                className={secondaryBtn}
                                onClick={() =>
                                    downloadErrorRows(
                                        sheet.headers,
                                        result.rows.filter((row) => row.status === 'error').map((row) => ({ cells: cellsOf(row.rowNumber), errors: row.errors }))
                                    )
                                }
                            >
                                <Download className="h-4 w-4" /> Télécharger les lignes en erreur
                            </button>
                        )}
                        <button type="button" className={secondaryBtn} onClick={restart}>
                            Importer un autre fichier
                        </button>
                        <Link href={studentsPath} className={primaryBtn}>
                            Voir les élèves
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
