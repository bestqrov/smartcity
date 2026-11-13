import prisma from '../../config/database';
import { createBranch } from './branches.service';
import { BranchLimitError } from '../packs/packs.limits';

jest.mock('../../config/database', () => {
    const tx = { branch: { count: jest.fn(), create: jest.fn() }, school: { findUnique: jest.fn() } };
    return {
        __esModule: true,
        default: { $transaction: jest.fn((cb: any) => cb(tx)), __tx: tx },
    };
});

const tx = (prisma as any).__tx;
const SCHOOL = { id: 'sc1', status: 'ACTIVE', trialEndsAt: null, pack: { name: 'Pro', maxBranches: 2 } };

beforeEach(() => {
    jest.clearAllMocks();
    tx.school.findUnique.mockResolvedValue(SCHOOL);
    tx.branch.count.mockResolvedValue(1);
    tx.branch.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'b2', ...data }));
});

describe('createBranch', () => {
    it('creates the branch in the caller school like signup does', async () => {
        const branch = await createBranch('sc1', { name: '  Annexe Agdal ', city: 'Rabat', address: '12 rue X', phone: '0600000000' });
        expect(tx.branch.create).toHaveBeenCalledWith({
            data: { schoolId: 'sc1', name: 'Annexe Agdal', city: 'Rabat', address: '12 rue X', phone: '0600000000' },
        });
        expect(branch.id).toBe('b2');
    });

    it('defaults city to an empty string and ignores a schoolId in the body', async () => {
        await createBranch('sc1', { name: 'Annexe', schoolId: 'other' } as any);
        expect(tx.branch.create.mock.calls[0][0].data).toEqual({ schoolId: 'sc1', name: 'Annexe', city: '' });
    });

    it('validates the fields', async () => {
        await expect(createBranch('sc1', { name: 'A' })).rejects.toThrow('Name must be 2 to 80 characters');
        await expect(createBranch('sc1', { name: 'x'.repeat(81) })).rejects.toThrow('Name must be 2 to 80 characters');
        await expect(createBranch('sc1', { name: 'Ok', city: 'x'.repeat(61) })).rejects.toThrow('City must be at most 60 characters');
        await expect(createBranch('sc1', { name: 'Ok', address: 'x'.repeat(201) })).rejects.toThrow('Address must be at most 200 characters');
        await expect(createBranch('sc1', { name: 'Ok', phone: 'abc' })).rejects.toThrow('Invalid phone number');
        expect(tx.branch.create).not.toHaveBeenCalled();
    });

    it('refuses when the pack branch limit is reached', async () => {
        tx.branch.count.mockResolvedValue(2);
        await expect(createBranch('sc1', { name: 'Annexe' })).rejects.toBeInstanceOf(BranchLimitError);
        expect(tx.branch.create).not.toHaveBeenCalled();
    });

    it('refuses with TRIAL_EXPIRED when the trial is over', async () => {
        tx.school.findUnique.mockResolvedValue({ ...SCHOOL, status: 'PENDING', trialEndsAt: new Date(Date.now() - 1000) });
        await expect(createBranch('sc1', { name: 'Annexe' })).rejects.toThrow('TRIAL_EXPIRED');
        expect(tx.branch.create).not.toHaveBeenCalled();
    });
});
