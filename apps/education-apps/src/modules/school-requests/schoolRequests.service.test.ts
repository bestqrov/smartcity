import prisma from '../../config/database';
import {
    countNewSchoolRequests,
    createSchoolRequest,
    listMySchoolRequests,
    listSchoolRequests,
    MAX_MESSAGE,
    updateSchoolRequest,
} from './schoolRequests.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
        school: { findUnique: jest.fn() },
        pack: { findFirst: jest.fn() },
        schoolRequest: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    },
}));

const db = prisma as any;
const BRANCH = '6ab050b281878c35b0f00701';
const SCHOOL = '6ab050b281878c35b0f00702';
const USER = '6ab050b281878c35b0f00703';
const REQ = '6ab050b281878c35b0f00704';

const school = { id: SCHOOL, institutionType: 'PRIVATE_SCHOOL', pack: { id: 'p-big', name: 'Pro', monthlyPrice: 900 } };
const smallPack = { id: 'p-small', code: 'STARTER', name: 'Starter', monthlyPrice: 300, institutionTypes: ['PRIVATE_SCHOOL'] };

beforeEach(() => {
    jest.resetAllMocks();
    db.branch.findUnique.mockResolvedValue({ schoolId: SCHOOL });
    db.school.findUnique.mockResolvedValue(school);
    db.pack.findFirst.mockResolvedValue(smallPack);
    db.schoolRequest.findFirst.mockResolvedValue(null);
    db.schoolRequest.create.mockImplementation(({ data }: any) => Promise.resolve({ id: REQ, ...data }));
});

describe('createSchoolRequest validation', () => {
    it('refuses an unknown kind', async () => {
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'HACK', message: 'x' })).rejects.toThrow(/kind must be/);
        expect(db.schoolRequest.create).not.toHaveBeenCalled();
    });

    it('requires a message for a feature request', async () => {
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'FEATURE', message: '   ' })).rejects.toThrow('Message is required');
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'FEATURE' })).rejects.toThrow('Message is required');
    });

    it('refuses a non-text or too long message', async () => {
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PROBLEM', message: 42 })).rejects.toThrow('must be text');
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'OTHER', message: 'a'.repeat(MAX_MESSAGE + 1) })).rejects.toThrow('too long');
    });

    it('stores the school and branch of the token, never those of the body', async () => {
        await createSchoolRequest(BRANCH, USER, { kind: 'FEATURE', message: '  Export Excel  ', schoolId: 'other', branchId: 'other', status: 'DONE' });
        expect(db.branch.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: BRANCH } }));
        const data = db.schoolRequest.create.mock.calls[0][0].data;
        expect(data).toEqual({ schoolId: SCHOOL, branchId: BRANCH, byUserId: USER, kind: 'FEATURE', message: 'Export Excel', targetPackId: null, targetPackName: null });
    });

    it('records a downgrade to a cheaper pack with an optional message', async () => {
        await createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE', targetPackCode: 'STARTER' });
        const data = db.schoolRequest.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ kind: 'PACK_DOWNGRADE', targetPackId: 'p-small', targetPackName: 'Starter', message: '' });
    });

    it('refuses a downgrade without a target, to a pricier pack, or to another type', async () => {
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE' })).rejects.toThrow('Target pack is required');
        db.pack.findFirst.mockResolvedValueOnce({ ...smallPack, monthlyPrice: 1200 });
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE', targetPackCode: 'MAX' })).rejects.toThrow('Only a smaller pack');
        db.pack.findFirst.mockResolvedValueOnce({ ...smallPack, institutionTypes: ['LANGUAGE_CENTER'] });
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE', targetPackCode: 'STARTER' })).rejects.toThrow('institution type');
        db.pack.findFirst.mockResolvedValueOnce(null);
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE', targetPackCode: 'NOPE' })).rejects.toThrow('Pack not found');
        expect(db.schoolRequest.create).not.toHaveBeenCalled();
    });

    it('refuses a second pending downgrade', async () => {
        db.schoolRequest.findFirst.mockResolvedValue({ id: 'old' });
        await expect(createSchoolRequest(BRANCH, USER, { kind: 'PACK_DOWNGRADE', targetPackCode: 'STARTER' })).rejects.toThrow('already pending');
    });
});

describe('listMySchoolRequests', () => {
    it('only reads the requests of the caller school', async () => {
        db.schoolRequest.findMany.mockResolvedValue([]);
        await listMySchoolRequests(BRANCH);
        expect(db.schoolRequest.findMany.mock.calls[0][0].where).toEqual({ schoolId: SCHOOL });
    });

    it('fails when the branch is unknown', async () => {
        db.branch.findUnique.mockResolvedValue(null);
        await expect(listMySchoolRequests(BRANCH)).rejects.toThrow('Branch not found');
        expect(db.schoolRequest.findMany).not.toHaveBeenCalled();
    });
});

describe('super admin', () => {
    it('filters the list by a known status only', async () => {
        db.schoolRequest.findMany.mockResolvedValue([]);
        await listSchoolRequests('NEW');
        expect(db.schoolRequest.findMany.mock.calls[0][0].where).toEqual({ status: 'NEW' });
        await listSchoolRequests('BOGUS');
        expect(db.schoolRequest.findMany.mock.calls[1][0].where).toEqual({});
    });

    it('counts the NEW requests', async () => {
        db.schoolRequest.count.mockResolvedValue(3);
        expect(await countNewSchoolRequests()).toBe(3);
        expect(db.schoolRequest.count).toHaveBeenCalledWith({ where: { status: 'NEW' } });
    });

    it('updates the status and the reply', async () => {
        db.schoolRequest.findUnique.mockResolvedValue({ id: REQ });
        db.schoolRequest.update.mockResolvedValue({ id: REQ });
        await updateSchoolRequest(REQ, { status: 'DONE', reply: '  Fait  ' });
        expect(db.schoolRequest.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: REQ }, data: { status: 'DONE', reply: 'Fait' } }));
    });

    it('clears an empty reply', async () => {
        db.schoolRequest.findUnique.mockResolvedValue({ id: REQ });
        await updateSchoolRequest(REQ, { reply: '' });
        expect(db.schoolRequest.update.mock.calls[0][0].data).toEqual({ reply: null });
    });

    it('refuses a bad status, an empty update and an unknown request', async () => {
        await expect(updateSchoolRequest(REQ, { status: 'CLOSED' })).rejects.toThrow('status must be');
        await expect(updateSchoolRequest(REQ, {})).rejects.toThrow('Nothing to update');
        db.schoolRequest.findUnique.mockResolvedValue(null);
        await expect(updateSchoolRequest(REQ, { status: 'DONE' })).rejects.toThrow('Request not found');
        expect(db.schoolRequest.update).not.toHaveBeenCalled();
    });
});
