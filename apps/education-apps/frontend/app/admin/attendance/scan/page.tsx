'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, CheckCircle2, XCircle } from 'lucide-react';
import { scanAttendance } from '@/lib/services/attendance';
import { groupsService } from '@/lib/services/groups';
import type { Group } from '@/types';

type ScanResult = { type: 'success' | 'error'; message: string } | null;

const RESCAN_COOLDOWN_MS = 3000;

export default function AttendanceScanPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [lastResult, setLastResult] = useState<ScanResult>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
    const processingRef = useRef(false);

    useEffect(() => {
        groupsService.getAll().then(setGroups).catch(() => setGroups([]));
    }, []);

    useEffect(() => {
        if (!selectedGroupId) return;

        setCameraError(null);
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        scanner
            .start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: 250 },
                async (decodedText) => {
                    const now = Date.now();
                    const last = lastCodeRef.current;
                    if (processingRef.current) return;
                    if (last && last.code === decodedText && now - last.at < RESCAN_COOLDOWN_MS) {
                        return;
                    }
                    lastCodeRef.current = { code: decodedText, at: now };
                    processingRef.current = true;

                    try {
                        const attendance = await scanAttendance(decodedText, selectedGroupId);
                        setLastResult({ type: 'success', message: `Présence enregistrée : ${attendance.status}` });
                    } catch (error: any) {
                        setLastResult({
                            type: 'error',
                            message: error?.response?.data?.error || 'Échec du scan',
                        });
                    } finally {
                        processingRef.current = false;
                    }
                },
                () => {
                    // ignore per-frame decode failures — expected while camera searches for a code
                }
            )
            .catch(() => setCameraError("Impossible de démarrer la caméra. Vérifiez les autorisations."));

        return () => {
            scanner.stop().catch(() => undefined);
        };
    }, [selectedGroupId]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Scanner de présence</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Sélectionnez un groupe puis scannez la carte QR de chaque élève.
                </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Groupe
                    </label>
                    <select
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedGroupId}
                        onChange={(e) => {
                            setSelectedGroupId(e.target.value);
                            setLastResult(null);
                            lastCodeRef.current = null;
                        }}
                    >
                        <option value="">Sélectionner un groupe…</option>
                        {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </div>

                {!selectedGroupId && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400 dark:text-slate-500">
                        <QrCode size={40} />
                        <p className="text-sm">Choisissez un groupe pour démarrer le scan</p>
                    </div>
                )}

                {selectedGroupId && (
                    <div className="mx-auto max-w-sm">
                        <div id="qr-reader" className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" />
                        {cameraError && (
                            <p className="mt-3 text-center text-sm font-medium text-red-600 dark:text-red-400">
                                {cameraError}
                            </p>
                        )}
                    </div>
                )}

                {lastResult && (
                    <div
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium ${
                            lastResult.type === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30'
                                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                        }`}
                    >
                        {lastResult.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                        <span>{lastResult.message}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
