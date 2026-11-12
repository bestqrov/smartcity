// src/modules/packs/packs.limits.ts
import type { Response } from 'express';
import prisma from '../../config/database';
import { DEFAULT_INSTITUTION_TYPE } from './packs.constants';

// The pack's student limit applies to the whole school (all its branches); only active students count.
// A null limit (Premium, Crèche Plus) or a school without a pack means no limit.
export interface SchoolCapacity {
    schoolId: string;
    status: string;
    institutionType: string;
    packCode: string | null;
    packName: string | null;
    limit: number | null;
    current: number;
}

export interface StudentLimitDetails {
    limit: number;
    current: number;
    adding: number;
    packName: string | null;
}

export class StudentLimitError extends Error {
    readonly details: StudentLimitDetails;

    constructor(details: StudentLimitDetails) {
        super('STUDENT_LIMIT_REACHED');
        this.name = 'StudentLimitError';
        this.details = details;
    }
}

export const getSchoolCapacity = async (branchId: string): Promise<SchoolCapacity> => {
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: {
            school: {
                select: {
                    id: true,
                    status: true,
                    institutionType: true,
                    pack: { select: { code: true, name: true, maxStudents: true } },
                },
            },
        },
    });
    const school = branch?.school;
    if (!school) throw new Error('School not found');

    const branches = await prisma.branch.findMany({ where: { schoolId: school.id }, select: { id: true } });
    const current = await prisma.student.count({
        where: { active: true, branchId: { in: branches.map((item) => item.id) } },
    });

    return {
        schoolId: school.id,
        status: school.status,
        institutionType: school.institutionType ?? DEFAULT_INSTITUTION_TYPE,
        packCode: school.pack?.code ?? null,
        packName: school.pack?.name ?? null,
        limit: school.pack?.maxStudents ?? null,
        current,
    };
};

export const remainingPlaces = (capacity: Pick<SchoolCapacity, 'limit' | 'current'>): number | null =>
    capacity.limit === null ? null : Math.max(0, capacity.limit - capacity.current);

export const assertStudentCapacity = async (branchId: string, adding: number): Promise<SchoolCapacity> => {
    const capacity = await getSchoolCapacity(branchId);
    if (capacity.limit !== null && capacity.current + adding > capacity.limit) {
        throw new StudentLimitError({ limit: capacity.limit, current: capacity.current, adding, packName: capacity.packName });
    }
    return capacity;
};

// 403 with a machine-readable code and the numbers: the frontend opens the upgrade dialog from them.
export const sendStudentLimitError = (res: Response, error: StudentLimitError): void => {
    const { limit, current, adding } = error.details;
    res.status(403).json({
        success: false,
        error: 'STUDENT_LIMIT_REACHED',
        message: `Limite du pack atteinte : ${limit} élèves autorisés, ${current} inscrits, ${adding} à ajouter.`,
        data: error.details,
    });
};
