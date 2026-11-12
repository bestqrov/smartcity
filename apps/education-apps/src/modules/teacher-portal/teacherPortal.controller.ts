import { Request, Response } from 'express';
import { sendError } from '../../utils/response';
import { respond } from '../transport/http';
import * as grades from '../grades/grades.service';
import { findTeacherByToken, getTeacherPortal, PortalTeacher } from './teacherPortal.service';

// Public, passwordless: the token is the credential. Every call re-resolves the teacher and passes
// { branchId, teacherId } to the grades service, which refuses any group the teacher does not teach.
const withTeacher =
    (handler: (teacher: PortalTeacher, req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response): Promise<void> => {
        const teacher = await findTeacherByToken(req.params.token);
        if (!teacher) {
            sendError(res, 'Not found', 'Not found', 404);
            return;
        }
        await handler(teacher, req, res);
    };

const scopeOf = (teacher: PortalTeacher): grades.GradesScope => ({ branchId: teacher.branchId, teacherId: teacher.id });

export const getPortal = withTeacher((teacher, _req, res) =>
    respond(res, () => getTeacherPortal(teacher), { message: 'Portal retrieved successfully', failure: 'Failed to retrieve portal' })
);

export const createEvaluation = withTeacher((teacher, req, res) =>
    respond(res, () => grades.createEvaluation(scopeOf(teacher), req.body || {}, `teacher:${teacher.id}`), {
        message: 'Evaluation created successfully',
        failure: 'Failed to create evaluation',
        status: 201,
    })
);

export const updateEvaluation = withTeacher((teacher, req, res) =>
    respond(res, () => grades.updateEvaluation(scopeOf(teacher), req.params.id, req.body || {}), {
        message: 'Evaluation updated successfully',
        failure: 'Failed to update evaluation',
    })
);

export const deleteEvaluation = withTeacher((teacher, req, res) =>
    respond(res, () => grades.deleteEvaluation(scopeOf(teacher), req.params.id), {
        message: 'Evaluation deleted successfully',
        failure: 'Failed to delete evaluation',
    })
);

export const saveGrades = withTeacher((teacher, req, res) =>
    respond(res, () => grades.saveGrades(scopeOf(teacher), req.params.id, req.body?.grades), {
        message: 'Grades saved successfully',
        failure: 'Failed to save grades',
    })
);

export const publish = withTeacher((teacher, req, res) =>
    respond(res, () => grades.setPublished(scopeOf(teacher), req.params.id, req.body?.published), {
        message: 'Evaluation updated successfully',
        failure: 'Failed to publish evaluation',
    })
);
