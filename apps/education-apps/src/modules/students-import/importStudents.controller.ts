// src/modules/students-import/importStudents.controller.ts
import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { StudentLimitError, sendStudentLimitError } from '../packs/packs.limits';
import { commitImport, validateImport } from './importStudents.service';

const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof StudentLimitError) return sendStudentLimitError(res, error);
    if (error instanceof Error && error.name.startsWith('PrismaClient')) {
        console.error(error);
        sendError(res, 'Internal server error', label, 500);
        return;
    }
    sendError(res, error instanceof Error ? error.message : String(error), label, 400);
};

// branchId always comes from tenantScope, never from the body.
export const validate = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await validateImport(req.branchId!, req.body?.rows);
        // groupIds is an internal Map (group ids): not sent to the client.
        sendSuccess(
            res,
            { rows: result.rows, counts: result.counts, missingGroups: result.missingGroups, capacity: result.capacity, parents: result.parents },
            'Import validated'
        );
    } catch (error) {
        fail(res, error, 'Failed to validate import');
    }
};

export const commit = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await commitImport(req.branchId!, req.body?.rows, req.body?.createMissingGroups === true);
        sendSuccess(res, result, 'Import done', 201);
    } catch (error) {
        fail(res, error, 'Failed to import students');
    }
};
