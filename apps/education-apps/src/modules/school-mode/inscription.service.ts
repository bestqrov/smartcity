// src/modules/school-mode/inscription.service.ts
import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { assertStudentCapacity } from '../packs/packs.limits';
import { branchHasFeature } from '../packs/packFeatures';
import { normalizePhone } from '../students-import/normalize';
import { createSubscription } from '../transport/subscriptions.service';
import { isLevelCode, levelsOfCycles } from './levels';
import { currentSchoolYear, startMonthFor } from './schoolYear';

const DOCUMENTS = ['BIRTH_CERT', 'PHOTOS', 'LEAVING_CERT', 'LAST_REPORT', 'PARENT_CIN', 'VACCINATION'];
const DISCOUNTS = [0, 10, 15, 20];
const METHODS = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const round = (n: number) => Math.round(n * 100) / 100;

const text = (value: unknown, max = 200): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const phone = (value: unknown): string | undefined => {
    const raw = text(value, 30);
    return raw ? normalizePhone(raw).value : undefined;
};
const money = (value: unknown): number => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0) throw new Error('Montant invalide');
    return Math.round(n * 100) / 100;
};

/** Amount paid at inscription: fees first (inscription + insurance), then the first month; advance months go through « Mensualités ». */
export const splitPaid = (paid: number, fees: number, firstMonth: number) => {
    paid = round(paid);
    fees = round(fees);
    firstMonth = round(firstMonth);
    if (paid > round(fees + firstMonth)) throw new Error('Le montant dépasse les frais et le premier mois : encaissez les mois suivants depuis « Mensualités ».');
    const feesPart = Math.min(paid, fees);
    return { fees: feesPart, firstMonth: round(paid - feesPart) };
};

export const registerSchoolStudent = async (branchId: string, input: Record<string, any>, now = new Date()) => {
    // ---- validation (French sentences: shown as they are by the form)
    const name = text(input.name, 80);
    const surname = text(input.surname, 80);
    if (!name || !surname) throw new Error('Le prénom et le nom sont obligatoires');
    const settings = await prisma.settings.findUnique({ where: { branchId } });
    const levels = levelsOfCycles(settings?.schoolCycles ?? []);
    if (!isLevelCode(input.level) || !levels.includes(input.level)) throw new Error('Choisissez un niveau parmi les cycles de l’établissement');
    if (input.gender !== undefined && input.gender !== null && !['M', 'F'].includes(input.gender)) throw new Error('Le sexe doit être M ou F');
    const massar = text(input.massarNumber, 20)?.toUpperCase();
    if (massar && !/^[A-Z]\d{9}$/.test(massar)) throw new Error('Code Massar invalide (une lettre suivie de 9 chiffres)');
    const discount = Number(input.siblingDiscount ?? 0);
    if (!DISCOUNTS.includes(discount)) throw new Error('Réduction fratrie invalide');
    if (input.method !== undefined && input.method !== null && input.method !== '' && !METHODS.includes(input.method)) throw new Error('Mode de paiement invalide');
    const method = METHODS.includes(input.method) ? input.method : 'CASH';
    let birthDate: Date | undefined;
    if (input.birthDate !== undefined && input.birthDate !== null && input.birthDate !== '') {
        birthDate = new Date(input.birthDate);
        if (typeof input.birthDate !== 'string' || Number.isNaN(birthDate.getTime())) throw new Error('Date de naissance invalide');
    }
    const bloodGroup = typeof input.bloodGroup === 'string' ? input.bloodGroup.trim().toUpperCase() : input.bloodGroup ?? '';
    if (bloodGroup !== '' && !BLOOD_GROUPS.includes(bloodGroup)) throw new Error('Groupe sanguin invalide');
    const authorizedPickup = Array.isArray(input.authorizedPickup)
        ? input.authorizedPickup.filter((p: unknown): p is string => typeof p === 'string' && !!p.trim()).map((p: string) => p.trim().slice(0, 120)).slice(0, 10)
        : undefined;
    const parentPhone = phone(input.parentPhone);

    await assertStudentCapacity(branchId, 1);
    if (massar) {
        const other = await prisma.student.findFirst({ where: { branchId, massarNumber: massar }, select: { name: true, surname: true } });
        if (other) throw new Error(`Code Massar déjà utilisé par ${other.name} ${other.surname}`);
    }

    let groupIds: string[] = [];
    if (input.groupId !== undefined && input.groupId !== null && input.groupId !== '') {
        const group = typeof input.groupId === 'string' && /^[a-f0-9]{24}$/.test(input.groupId)
            ? await prisma.group.findFirst({ where: { id: input.groupId, branchId }, select: { id: true } })
            : null;
        if (!group) throw new Error('Groupe introuvable');
        groupIds = [group.id];
    }

    // ---- fees: the grid, then what the office typed
    const grid = await prisma.tuitionFee.findUnique({ where: { branchId_level: { branchId, level: input.level } } });
    const inscriptionFee = money(input.fees?.inscriptionFee ?? grid?.inscriptionFee ?? 0);
    const insuranceFee = money(input.fees?.insuranceFee ?? grid?.insuranceFee ?? 0);
    const baseMonthly = money(input.fees?.monthlyFee ?? grid?.monthlyFee ?? 0);
    const monthlyFee = Math.round(baseMonthly * (100 - discount)) / 100;
    const inscriptionAmount = round(inscriptionFee + insuranceFee); // the first month is tracked by the dues, not here
    const firstDue = round(inscriptionAmount + monthlyFee);
    const paid = money(input.amountPaid);
    const split = splitPaid(paid, inscriptionAmount, monthlyFee);
    const schoolYear = settings?.schoolYear || currentSchoolYear(now);
    const startMonth = startMonthFor(now);

    const created = await prisma.$transaction(async (tx) => {
        // Checked again inside the transaction: two concurrent inscriptions with the same code conflict here.
        if (massar) {
            const other = await tx.student.findFirst({ where: { branchId, massarNumber: massar }, select: { name: true, surname: true } });
            if (other) throw new Error(`Code Massar déjà utilisé par ${other.name} ${other.surname}`);
        }
        let parentId: string | undefined;
        if (parentPhone) {
            const existing = await tx.parent.findFirst({ where: { branchId, phone: parentPhone }, select: { id: true } });
            parentId =
                existing?.id ??
                (
                    await tx.parent.create({
                        data: {
                            name: text(input.parentName) || text(input.fatherName) || text(input.motherName) || `Parent de ${name} ${surname}`,
                            phone: parentPhone,
                            branchId,
                            accessTokenHash: hashToken(generateRawToken()),
                            linkIssuedAt: null,
                        },
                        select: { id: true },
                    })
                ).id;
        }

        const student = await tx.student.create({
            data: {
                branchId,
                name,
                surname,
                nameAr: text(input.nameAr, 80),
                surnameAr: text(input.surnameAr, 80),
                gender: input.gender ?? undefined,
                nationality: text(input.nationality, 60) ?? 'Marocaine',
                birthDate,
                birthPlace: text(input.birthPlace, 80),
                address: text(input.address, 300),
                photo: typeof input.photo === 'string' && input.photo.startsWith('data:image/') ? input.photo : undefined,
                massarNumber: massar,
                schoolLevel: input.level,
                schoolYear,
                enrollmentKind: input.enrollmentKind === 'RETURNING' ? 'RETURNING' : 'NEW',
                currentSchool: text(input.previousSchool, 120),
                fatherName: text(input.fatherName, 120),
                fatherCin: text(input.fatherCin, 20)?.toUpperCase(),
                fatherPhone: phone(input.fatherPhone),
                fatherJob: text(input.fatherJob, 80),
                motherName: text(input.motherName, 120),
                motherCin: text(input.motherCin, 20)?.toUpperCase(),
                motherPhone: phone(input.motherPhone),
                motherJob: text(input.motherJob, 80),
                parentName: text(input.parentName, 120),
                parentRelation: text(input.parentRelation, 40),
                parentPhone,
                payer: ['FATHER', 'MOTHER', 'GUARDIAN'].includes(input.payer) ? input.payer : undefined,
                emergencyName: text(input.emergencyName, 120),
                emergencyPhone: phone(input.emergencyPhone),
                bloodGroup: bloodGroup || undefined,
                healthNotes: text(input.allergies, 500),
                chronicDiseases: text(input.chronicDiseases, 500),
                medications: text(input.medications, 500),
                careConsent: typeof input.careConsent === 'boolean' ? input.careConsent : undefined,
                authorizedPickup,
                documents: Array.isArray(input.documents) ? input.documents.filter((d: string) => DOCUMENTS.includes(d)) : [],
                monthlyFee,
                tuitionStartMonth: startMonth,
                siblingDiscount: discount || undefined,
                parentId,
                groupIds,
                accessTokenHash: hashToken(generateRawToken()),
                portalTokenHash: hashToken(generateRawToken()),
            },
        });

        await tx.inscription.create({
            data: { studentId: student.id, branchId, type: 'SCOLARITE', category: input.level, amount: inscriptionAmount, date: now, note: `Inscription ${schoolYear}` },
        });

        const payments = [];
        if (split.fees > 0) {
            payments.push(await tx.payment.create({ data: { studentId: student.id, branchId, amount: split.fees, method, date: now, note: 'Frais d’inscription et assurance' } }));
        }
        if (split.firstMonth > 0) {
            payments.push(
                await tx.payment.create({ data: { studentId: student.id, branchId, amount: split.firstMonth, method, date: now, forMonth: startMonth, note: `Mensualité ${startMonth}` } })
            );
        }
        for (const p of payments) {
            // Same row as createTransaction, written with the transaction client.
            await tx.transaction.create({
                data: { type: 'INCOME', amount: p.amount, category: 'Paiement Scolarité', branchId, description: `Paiement de ${name} ${surname} (${method})`, date: now },
            });
        }
        return { student, payments };
    });

    // Transport is optional: the inscription is committed, so a transport failure is reported, not thrown.
    let transportError: string | undefined;
    if (input.transport?.routeId && input.transport?.stopId) {
        if (!(await branchHasFeature(branchId, 'TRANSPORT'))) {
            transportError = "Le transport n'est pas inclus dans le pack";
        } else try {
            await createSubscription({ studentId: created.student.id, routeId: input.transport.routeId, stopId: input.transport.stopId, branchId, startDate: now });
        } catch (error) {
            transportError = error instanceof Error ? error.message : String(error);
        }
    }

    return {
        student: created.student,
        summary: { inscriptionFee, insuranceFee, monthlyFee, firstDue, paid, remaining: round(firstDue - paid), startMonth },
        ...(transportError ? { transportError } : {}),
    };
};
