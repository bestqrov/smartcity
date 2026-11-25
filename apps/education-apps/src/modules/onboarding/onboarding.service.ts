import prisma from '../../config/database';

// Onboarding checklist of a new establishment. A step is "done" from the data itself, never stored:
// only skipped optional steps and the hidden flag live on Settings.
export const STEP_KEYS = ['profile', 'prices', 'formations', 'groups', 'teachers', 'staff', 'transport', 'firstStudent'] as const;
export type StepKey = (typeof STEP_KEYS)[number];
export const OPTIONAL_STEPS: StepKey[] = ['staff', 'transport'];

export const STEP_HREF: Record<StepKey, string> = {
    profile: '/admin/settings',
    prices: '/admin/finance/prix',
    formations: '/admin/formation-pro/new',
    groups: '/admin/groups',
    teachers: '/admin/teachers',
    staff: '/admin/secretaire',
    transport: '/admin/transport',
    firstStudent: '/admin/inscriptions',
};

export interface OnboardingStep {
    key: StepKey;
    done: boolean;
    skipped: boolean;
    optional: boolean;
    href: string;
}

export interface OnboardingState {
    steps: OnboardingStep[];
    completed: boolean;
    dismissed: boolean;
}

export const getOnboarding = async (branchId: string): Promise<OnboardingState> => {
    const [branch, settings] = await Promise.all([
        prisma.branch.findUnique({
            where: { id: branchId },
            select: { school: { select: { institutionType: true, phone: true, pack: { select: { features: true } } } } },
        }),
        prisma.settings.findUnique({ where: { branchId } }),
    ]);
    const school = branch?.school;
    const type = school?.institutionType ?? 'PRIVATE_SCHOOL';
    const cycles = settings?.schoolCycles ?? [];
    // Same rule as schoolModeGate.
    const schoolMode = type === 'PRIVATE_SCHOOL' || cycles.length > 0;
    const features = school?.pack ? school.pack.features : null;

    const visible: StepKey[] = STEP_KEYS.filter((key) => {
        if (key === 'formations') return type === 'VOCATIONAL_TRAINING';
        if (key === 'transport') return features === null || features.includes('TRANSPORT');
        return true;
    });

    const where = { branchId };
    const [prices, formations, groups, teachers, staff, vehicles, routes, students] = await Promise.all([
        schoolMode ? prisma.tuitionFee.count({ where }) : prisma.pricing.count({ where: { branchId, active: true } }),
        visible.includes('formations') ? prisma.formation.count({ where }) : Promise.resolve(0),
        prisma.group.count({ where }),
        prisma.teacher.count({ where }),
        prisma.user.count({ where: { branchId, role: 'SECRETARY' } }),
        visible.includes('transport') ? prisma.vehicle.count({ where }) : Promise.resolve(0),
        visible.includes('transport') ? prisma.transportRoute.count({ where }) : Promise.resolve(0),
        prisma.student.count({ where }),
    ]);

    const hasPhone = !!(school?.phone?.trim() || settings?.contactInfo?.trim());
    const done: Record<StepKey, boolean> = {
        profile: !!settings?.schoolName?.trim() && hasPhone && (type !== 'PRIVATE_SCHOOL' || cycles.length > 0),
        prices: prices > 0,
        formations: formations > 0,
        groups: groups > 0,
        teachers: teachers > 0,
        staff: staff > 0,
        transport: vehicles > 0 && routes > 0,
        firstStudent: students > 0,
    };
    const skippedKeys = settings?.onboardingSkipped ?? [];

    const steps = visible.map((key) => {
        const optional = OPTIONAL_STEPS.includes(key);
        return { key, done: done[key], skipped: optional && skippedKeys.includes(key), optional, href: STEP_HREF[key] };
    });
    return {
        steps,
        // Optional steps are suggestions: they never keep the checklist open, so running schools are not nagged.
        completed: steps.every((s) => s.done || s.optional),
        dismissed: settings?.onboardingDismissed ?? false,
    };
};

export const updateOnboarding = async (branchId: string, body: Record<string, unknown>): Promise<OnboardingState> => {
    const settings = await prisma.settings.findUnique({ where: { branchId } });
    if (!settings) throw new Error('Settings not found');
    const isOptional = (v: unknown): v is StepKey => typeof v === 'string' && (OPTIONAL_STEPS as string[]).includes(v);
    const skipped = settings.onboardingSkipped ?? [];

    if ('skip' in body) {
        if (!isOptional(body.skip)) throw new Error('Only optional steps can be skipped');
        const key = body.skip;
        await prisma.settings.update({ where: { branchId }, data: { onboardingSkipped: skipped.includes(key) ? skipped : [...skipped, key] } });
    } else if ('unskip' in body) {
        if (!isOptional(body.unskip)) throw new Error('Only optional steps can be skipped');
        const key = body.unskip;
        await prisma.settings.update({ where: { branchId }, data: { onboardingSkipped: skipped.filter((k) => k !== key) } });
    } else if ('dismissed' in body) {
        if (typeof body.dismissed !== 'boolean') throw new Error('dismissed must be a boolean');
        await prisma.settings.update({ where: { branchId }, data: { onboardingDismissed: body.dismissed } });
    } else {
        throw new Error('Nothing to update');
    }
    return getOnboarding(branchId);
};
