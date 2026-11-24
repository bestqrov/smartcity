import { resolveReferralCode } from '../sales-agents/salesAgents.service';
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { resolvePartnerOffer, offerPriceFor, packBasePrice } from '../partner-offer/partnerOffer.service';
import { assertId } from '../transport/ids';
import { DEFAULT_INSTITUTION_TYPE, InstitutionTypeValue, isInstitutionType } from '../packs/packs.constants';
import { getPlatformSettings } from '../platform/platformSettings.service';

export interface SignupSchoolData {
    referralCode?: unknown; // required; typed loosely because it comes straight from a public request body
    schoolName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName?: string;
    branchCity?: string;
    institutionType: InstitutionTypeValue;
    packCode?: string;
    offerPeriod?: unknown; // partner offer period; loosely typed, comes from a public request body
}

const OFFER_PERIODS = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'] as const;
type OfferPeriod = (typeof OFFER_PERIODS)[number];

// Thrown when the super admin has closed signups; the route answers 403 with this code.
export class SignupClosedError extends Error {
    readonly code = 'SIGNUP_CLOSED';
    constructor() {
        super('SIGNUP_CLOSED');
        this.name = 'SignupClosedError';
    }
}

// The pack named by the visitor (must be active and serve the type), else the default pack if it
// serves the type, else none — signup never fails because no default pack exists.
const resolveSignupPack = async (packCode: unknown, type: InstitutionTypeValue) => {
    if (packCode !== undefined && packCode !== null && packCode !== '') {
        // packCode comes from a public request body: never let a non-string reach Prisma.
        const code = typeof packCode === 'string' ? packCode.trim() : '';
        if (!code) throw new Error('Unknown or unavailable pack');
        const pack = await prisma.pack.findFirst({ where: { code, active: true } });
        if (!pack || !pack.institutionTypes.includes(type)) throw new Error('Unknown or unavailable pack');
        return pack;
    }

    // Each institution type has its own default pack; none means signup proceeds without a pack.
    return prisma.pack.findFirst({
        where: { isDefault: true, active: true, institutionTypes: { has: type } },
    });
};

export const signupSchool = async (data: SignupSchoolData) => {
    if (!isInstitutionType(data.institutionType)) {
        throw new Error('institutionType is required and must be valid');
    }

    const settings = await getPlatformSettings();
    if (!settings.signupOpen) throw new SignupClosedError();

    const agent = await resolveReferralCode(data.referralCode);

    // The chosen billing period is kept for every school; a partner's code (offer on) adds the discount.
    let offerPeriod: OfferPeriod | null = null;
    let discounts: Awaited<ReturnType<typeof resolvePartnerOffer>> = null;
    if (data.offerPeriod !== undefined && data.offerPeriod !== null && data.offerPeriod !== '') {
        offerPeriod = OFFER_PERIODS.find((value) => value === data.offerPeriod) ?? null;
        if (!offerPeriod) throw new Error('offerPeriod must be MONTHLY, SEMIANNUAL or YEARLY');
        if (!(settings.signupPeriods as string[]).includes(offerPeriod)) throw new Error('offerPeriod is not available');
        discounts = await resolvePartnerOffer(data.referralCode);
    }

    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const pack = await resolveSignupPack(data.packCode, data.institutionType);

    // The period and its price (discounted for a partner) are frozen on the school; both need a pack to price against.
    let offerFields: { partnerOffer: boolean; offerPeriod: OfferPeriod; offerPrice: number } | null = null;
    if (offerPeriod) {
        if (!pack) throw new Error('Unknown or unavailable pack');
        offerFields = discounts
            ? { partnerOffer: true, offerPeriod, offerPrice: offerPriceFor(pack, discounts, offerPeriod) }
            : { partnerOffer: false, offerPeriod, offerPrice: packBasePrice(pack, offerPeriod) };
    }

    const hashedPassword = await hashPassword(data.password);

    const schoolName = data.schoolName || `École de ${data.ownerName}`;
    const branchName = data.branchName || 'Établissement principal';
    const branchCity = data.branchCity ?? '';

    const trialEndsAt = new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000);

    try {
        return await prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: {
                    name: schoolName,
                    status: 'PENDING',
                    institutionType: data.institutionType,
                    packId: pack?.id ?? null,
                    salesAgentId: agent.id,
                    ...(offerFields ?? {}),
                    ownerName: data.ownerName,
                    ownerEmail: email,
                    ownerPhone: data.ownerPhone,
                    trialEndsAt,
                },
            });

            const branch = await tx.branch.create({
                data: {
                    schoolId: school.id,
                    name: branchName,
                    city: branchCity,
                },
            });

            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: data.ownerName,
                    role: 'OWNER',
                    schoolId: school.id,
                },
            });

            return { school, branch, user };
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Email already exists');
        }
        throw error;
    }
};

export const getSchoolBySchoolId = async (schoolId: string) => {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, include: { pack: true } });
    if (!school) {
        throw new Error('School not found');
    }
    return school;
};

export interface UpdateSchoolProfileData {
    name?: string;
    director?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
}

export const updateSchoolProfile = async (schoolId: string, data: UpdateSchoolProfileData) => {
    return prisma.school.update({ where: { id: schoolId }, data });
};

export const listSchools = async () => {
    return prisma.school.findMany({
        select: {
            id: true,
            name: true,
            ownerName: true,
            ownerEmail: true,
            ownerPhone: true,
            city: true,
            address: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
            institutionType: true,
            packId: true,
            pack: { select: { id: true, code: true, name: true } },
            salesAgentId: true,
            salesAgent: { select: { id: true, name: true, code: true } },
            partnerOffer: true,
            offerPeriod: true,
            offerPrice: true,
        },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateSchoolStatus = async (id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') => {
    return prisma.school.update({ where: { id }, data: { status } });
};

export const assignPackToSchool = async (schoolId: string, packId: string) => {
    assertId('School id', schoolId);
    assertId('Pack id', packId);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const pack = await prisma.pack.findFirst({ where: { id: packId, active: true } });
    if (!pack) throw new Error('Pack not found');

    const type = school.institutionType ?? DEFAULT_INSTITUTION_TYPE;
    if (!pack.institutionTypes.includes(type)) throw new Error('Pack does not serve this institution type');

    return prisma.school.update({ where: { id: schoolId }, data: { packId }, include: { pack: true } });
};

export interface AdminSchoolUpdate {
    name?: unknown;
    ownerName?: unknown;
    ownerEmail?: unknown;
    ownerPhone?: unknown;
    city?: unknown;
    address?: unknown;
    institutionType?: unknown;
    trialEndsAt?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requiredText = (value: unknown, field: string, max = 120): string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
    if (value.trim().length > max) throw new Error(`${field} is too long`);
    return value.trim();
};

const optionalText = (value: unknown, field: string, max = 200): string | null => {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error(`${field} must be a string`);
    if (value.trim().length > max) throw new Error(`${field} is too long`);
    return value.trim() || null;
};

// SUPER_ADMIN: edit a school's information, owner contact, institution type and trial end.
// A new owner email must be free among users; the owner's login email follows it.
export const updateSchoolByAdmin = async (schoolId: string, input: AdminSchoolUpdate) => {
    assertId('School id', schoolId);
    const body = (input ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if ('name' in body) data.name = requiredText(body.name, 'name');
    if ('ownerName' in body) data.ownerName = requiredText(body.ownerName, 'ownerName');
    if ('ownerPhone' in body) data.ownerPhone = optionalText(body.ownerPhone, 'ownerPhone', 30);
    if ('city' in body) data.city = optionalText(body.city, 'city', 80);
    if ('address' in body) data.address = optionalText(body.address, 'address');
    if ('institutionType' in body) {
        if (!isInstitutionType(body.institutionType)) throw new Error('institutionType is invalid');
        data.institutionType = body.institutionType;
    }
    if ('trialEndsAt' in body) {
        if (body.trialEndsAt === null || body.trialEndsAt === '') {
            data.trialEndsAt = null;
        } else {
            const date = typeof body.trialEndsAt === 'string' ? new Date(body.trialEndsAt) : null;
            if (!date || Number.isNaN(date.getTime())) throw new Error('trialEndsAt must be a valid date');
            data.trialEndsAt = date;
        }
    }

    let newEmail: string | null = null;
    if ('ownerEmail' in body) {
        const email = requiredText(body.ownerEmail, 'ownerEmail').toLowerCase();
        if (!EMAIL_RE.test(email)) throw new Error('ownerEmail is invalid');
        data.ownerEmail = email;
        newEmail = email;
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const owner = await prisma.user.findFirst({ where: { schoolId, role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
    const emailChanged = newEmail !== null && newEmail !== school.ownerEmail.toLowerCase();
    if (emailChanged) {
        const taken = await prisma.user.findUnique({ where: { email: newEmail! } });
        if (taken && taken.id !== owner?.id) throw new Error('Email already exists');
    }

    const userData: Record<string, unknown> = {};
    if (owner && newEmail !== null && newEmail !== owner.email) userData.email = newEmail;
    if (owner && typeof data.ownerName === 'string' && data.ownerName !== owner.name) userData.name = data.ownerName;

    try {
        return await prisma.$transaction(async (tx) => {
            if (owner && Object.keys(userData).length > 0) {
                await tx.user.update({ where: { id: owner.id }, data: userData });
            }
            return tx.school.update({ where: { id: schoolId }, data, include: { pack: true } });
        });
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email already exists');
        throw error;
    }
};

// SUPER_ADMIN: set a new password for the school's owner. The password is hashed and never logged or returned.
export const resetOwnerPassword = async (schoolId: string, password: unknown) => {
    assertId('School id', schoolId);
    if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters');
    if (password.length > 128) throw new Error('Password is too long');

    const owner = await prisma.user.findFirst({ where: { schoolId, role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
    if (!owner) throw new Error('Owner not found');

    await prisma.user.update({ where: { id: owner.id }, data: { password: await hashPassword(password) } });
    return { ok: true };
};
