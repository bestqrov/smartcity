import { update } from './students.controller';
import { updateStudent } from './students.service';

jest.mock('../../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('./students.service', () => ({ updateStudent: jest.fn() }));

const mockRes = () => {
    const res: any = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};
const call = async (body: Record<string, unknown>) => {
    const res = mockRes();
    await update({ params: { id: 's1' }, branchId: 'b1', body } as any, res);
    return res;
};

beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
beforeEach(() => {
    jest.clearAllMocks();
    (updateStudent as jest.Mock).mockResolvedValue({ id: 's1', accessTokenHash: 'h' });
});

describe('students update', () => {
    it('refuses a bad gender and a bad documents type', async () => {
        expect((await call({ gender: 'X' })).status).toHaveBeenCalledWith(400);
        expect((await call({ documents: 'acte' })).status).toHaveBeenCalledWith(400);
        expect((await call({ documents: [1] })).status).toHaveBeenCalledWith(400);
        expect(updateStudent).not.toHaveBeenCalled();
    });

    it('never passes branchId, accessTokenHash or active to the update', async () => {
        const res = await call({ name: 'Lina', gender: 'F', documents: ['acte'], branchId: 'b2', accessTokenHash: 'x', active: false });
        expect(res.status).toHaveBeenCalledWith(200);
        const data = (updateStudent as jest.Mock).mock.calls[0][2];
        expect(data).toEqual({ name: 'Lina', gender: 'F', documents: ['acte'] });
        expect((updateStudent as jest.Mock).mock.calls[0][1]).toBe('b1');
    });

    it('maps not found to 404 and Prisma errors to a generic 500', async () => {
        (updateStudent as jest.Mock).mockRejectedValueOnce(new Error('Student not found'));
        expect((await call({ name: 'A' })).status).toHaveBeenCalledWith(404);
        const prismaError = Object.assign(new Error('raw prisma details'), { name: 'PrismaClientKnownRequestError' });
        (updateStudent as jest.Mock).mockRejectedValueOnce(prismaError);
        const res = await call({ name: 'A' });
        expect(res.status).toHaveBeenCalledWith(500);
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('raw prisma');
    });
});
