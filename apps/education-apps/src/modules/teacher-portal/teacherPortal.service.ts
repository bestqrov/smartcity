import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { periodsFor } from '../grades/grades.service';

export interface PortalTeacher {
    id: string;
    name: string;
    branchId: string;
}

/** Resolves the teacher behind a portal link; null for any unknown or malformed token. */
export const findTeacherByToken = async (rawToken: string): Promise<PortalTeacher | null> => {
    if (typeof rawToken !== 'string' || !rawToken) return null;
    try {
        return await prisma.teacher.findFirst({
            where: { accessTokenHash: hashToken(rawToken) },
            select: { id: true, name: true, branchId: true },
        });
    } catch {
        return null;
    }
};

/** Everything the teacher space needs in one call: their groups (with students and evaluations) and the periods. */
export const getTeacherPortal = async (teacher: PortalTeacher) => {
    const { id: teacherId, branchId } = teacher;
    const [groups, periods, branch] = await Promise.all([
        prisma.group.findMany({
            where: { teacherId, branchId },
            select: {
                id: true,
                name: true,
                subject: true,
                level: true,
                type: true,
                students: { select: { id: true, name: true, surname: true } },
            },
            orderBy: { name: 'asc' },
        }),
        periodsFor(branchId),
        prisma.branch.findUnique({ where: { id: branchId }, include: { school: { select: { name: true, logo: true } } } }),
    ]);

    const evaluations =
        groups.length === 0
            ? []
            : await prisma.evaluation.findMany({
                  where: { branchId, groupId: { in: groups.map((g) => g.id) } },
                  include: { grades: true },
                  orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
              });

    return {
        teacher: { id: teacher.id, name: teacher.name },
        school: branch?.school ?? null,
        periods,
        groups: groups.map((g) => ({
            ...g,
            students: [...g.students].sort((a, b) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name)),
            evaluations: evaluations.filter((e) => e.groupId === g.id),
        })),
    };
};
