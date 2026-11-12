import * as portalService from './teacherPortal.service';
import * as grades from '../grades/grades.service';
import { getPortal, createEvaluation, saveGrades, publish } from './teacherPortal.controller';

jest.mock('../../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('./teacherPortal.service');
jest.mock('../grades/grades.service');

const m = (fn: unknown) => fn as jest.Mock;

const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const teacher = { id: 't1', name: 'Prof', branchId: 'b1' };

describe('teacherPortal.controller', () => {
    afterEach(() => jest.clearAllMocks());

    it('answers 404 on a bad token, for reads and mutations', async () => {
        m(portalService.findTeacherByToken).mockResolvedValue(null);
        for (const handler of [getPortal, createEvaluation, saveGrades, publish]) {
            const res = mockRes();
            await handler({ params: { token: 'bad', id: 'e1' }, body: {} } as any, res);
            expect(res.status).toHaveBeenCalledWith(404);
        }
        expect(grades.createEvaluation).not.toHaveBeenCalled();
        expect(grades.saveGrades).not.toHaveBeenCalled();
        expect(grades.setPublished).not.toHaveBeenCalled();
    });

    it('scopes every mutation to the teacher and their branch', async () => {
        m(portalService.findTeacherByToken).mockResolvedValue(teacher);
        m(grades.createEvaluation).mockResolvedValue({ id: 'e1' });
        m(grades.saveGrades).mockResolvedValue([]);
        m(grades.setPublished).mockResolvedValue({ id: 'e1' });

        await createEvaluation({ params: { token: 'tok' }, body: { groupId: 'g1', branchId: 'evil' } } as any, mockRes());
        expect(grades.createEvaluation).toHaveBeenCalledWith(
            { branchId: 'b1', teacherId: 't1' },
            { groupId: 'g1', branchId: 'evil' },
            'teacher:t1'
        );

        await saveGrades({ params: { token: 'tok', id: 'e1' }, body: { grades: [{ studentId: 's1', score: 1 }] } } as any, mockRes());
        expect(grades.saveGrades).toHaveBeenCalledWith({ branchId: 'b1', teacherId: 't1' }, 'e1', [{ studentId: 's1', score: 1 }]);

        await publish({ params: { token: 'tok', id: 'e1' }, body: { published: true } } as any, mockRes());
        expect(grades.setPublished).toHaveBeenCalledWith({ branchId: 'b1', teacherId: 't1' }, 'e1', true);
    });

    it('maps "Group not found" from the service to 404', async () => {
        m(portalService.findTeacherByToken).mockResolvedValue(teacher);
        m(grades.setPublished).mockRejectedValue(new Error('Group not found'));
        const res = mockRes();
        await publish({ params: { token: 'tok', id: 'e1' }, body: { published: true } } as any, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
