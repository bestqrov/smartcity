import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '@/lib/services/settings';

// Cycles of the active branch: non-empty = complete private school mode.
export function useSchoolCycles() {
    const [cycles, setCycles] = useState<string[]>([]);
    const [schoolYear, setSchoolYear] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const load = useCallback(() => {
        setLoading(true);
        getSettings()
            .then((s) => {
                setCycles(s.schoolCycles ?? []);
                setSchoolYear(s.schoolYear ?? null);
            })
            .catch(() => setCycles([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(load, [load]);
    return { cycles, schoolYear, schoolMode: cycles.length > 0, loading, reload: load };
}
