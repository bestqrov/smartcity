import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '@/lib/services/settings';

// Cycles of the active branch: non-empty = complete private school mode.
// `enabled` = false skips the settings call (roles that cannot read the settings).
export function useSchoolCycles(enabled = true) {
    const [cycles, setCycles] = useState<string[]>([]);
    const [schoolYear, setSchoolYear] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(() => {
        if (!enabled) {
            setCycles([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        getSettings()
            .then((s) => {
                setCycles(s.schoolCycles ?? []);
                setSchoolYear(s.schoolYear ?? null);
            })
            .catch(() => setCycles([]))
            .finally(() => setLoading(false));
    }, [enabled]);
    useEffect(load, [load]);
    return { cycles, schoolYear, schoolMode: cycles.length > 0, loading, reload: load };
}
