// frontend/components/packs/PackUpgradeHost.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PackUpgradeDialog from './PackUpgradeDialog';
import { registerUpgradeHandler } from '@/lib/packs/upgradeBus';
import type { StudentLimitDetails } from '@/lib/packs/limits';

// Mounted once per school layout: answers askForUpgrade() by showing the dialog.
export default function PackUpgradeHost() {
    const [details, setDetails] = useState<StudentLimitDetails | null>(null);
    const resolver = useRef<((upgraded: boolean) => void) | null>(null);

    useEffect(
        () =>
            registerUpgradeHandler(
                (next) =>
                    new Promise<boolean>((resolve) => {
                        resolver.current?.(false); // a second request replaces a pending one
                        resolver.current = resolve;
                        setDetails(next);
                    })
            ),
        []
    );

    const finish = useCallback((upgraded: boolean) => {
        resolver.current?.(upgraded);
        resolver.current = null;
        setDetails(null);
    }, []);

    return details ? <PackUpgradeDialog details={details} onDone={finish} /> : null;
}
