// frontend/lib/packs/upgradeBus.ts
// Lets plain code (services, the import wizard) open the upgrade dialog and wait for the outcome.
// PackUpgradeHost, mounted once in the admin and secretary layouts, registers the handler.
import type { StudentLimitDetails } from './limits';

type Handler = (details: StudentLimitDetails) => Promise<boolean>;

let handler: Handler | null = null;

export const registerUpgradeHandler = (next: Handler): (() => void) => {
    handler = next;
    return () => {
        if (handler === next) handler = null;
    };
};

// Resolves true once the school has upgraded, false if the user cancelled or no dialog is mounted.
export const askForUpgrade = (details: StudentLimitDetails): Promise<boolean> =>
    handler ? handler(details) : Promise.resolve(false);
