// src/modules/students-import/importStudents.service.test.ts
import prisma from '../../config/database';
import { assertStudentCapacity, getSchoolCapacity, StudentLimitError } from '../packs/packs.limits';
import { commitImport, MAX_IMPORT_ROWS, validateImport } from './importStudents.service';

jest.mock('../packs/packs.limits', () => {
    const actual = jest.requireActual('../packs/packs.limits');
    return { ...actual, getSchoolCapacity: jest.fn(), assertStudentCapacity: jest.fn() };
});

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findMany: jest.fn(), create: jest.fn() },
        group: { findMany: jest.fn(), create: jest.fn() },
    },
}));

const TODAY = new Date('2026-11-12T12:00:00Z');

beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { surname: 'Bennani', name: 'Omar', birthDate: new Date('2015-03-05T00:00:00Z'), massarNumber: null },
        { surname: 'X', name: 'Y', birthDate: null, massarNumber: 'J1' },
    ]);
    (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 'g1', name: 'CE2-A' }]);
    (getSchoolCapacity as jest.Mock).mockResolvedValue({ schoolId: 'sc1', limit: 300, current: 120, packName: 'Pro' });
});

describe('validateImport', () => {
    it('looks up duplicates and groups in the caller branch only', async () => {
        await validateImport('b1', [{ rowNumber: 2, surname: 'A', name: 'B' }], TODAY);
        expect(prisma.student.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1' },
            select: { surname: true, name: true, birthDate: true, massarNumber: true },
        });
        expect(prisma.group.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1' }, select: { id: true, name: true } });
        expect(getSchoolCapacity).toHaveBeenCalledWith('b1');
    });

    it('classifies valid rows, errors, duplicates in the database and duplicates within the file', async () => {
        const result = await validateImport(
            'b1',
            [
                { rowNumber: 2, surname: 'Alaoui', name: 'Sara', birthDate: '01/09/2016' },
                { rowNumber: 3, surname: 'BENNANI', name: 'omar', birthDate: '05/03/2015' },
                { rowNumber: 4, surname: 'Z', name: 'W', massarNumber: 'j1' },
                { rowNumber: 5, surname: 'alaoui', name: 'SARA', birthDate: '2016-09-01' },
                { rowNumber: 6, surname: '', name: 'Nobody' },
                { rowNumber: 7, surname: 'Same', name: 'Name' },
                { rowNumber: 8, surname: 'Same', name: 'Name' },
            ],
            TODAY
        );

        expect(result.rows.map((row) => [row.rowNumber, row.status])).toEqual([
            [2, 'valid'],
            [3, 'duplicate'],
            [4, 'duplicate'],
            [5, 'duplicate'],
            [6, 'error'],
            [7, 'valid'],
            [8, 'valid'],
        ]);
        expect(result.rows[1].errors).toEqual(['Élève déjà inscrit dans cet établissement']);
        expect(result.rows[3].errors).toEqual(['Doublon de la ligne 2 du fichier']);
        expect(result.counts).toEqual({ valid: 3, duplicate: 3, error: 1 });
    });

    it('lists missing groups once, matched case-insensitively, and warns on their rows', async () => {
        const result = await validateImport(
            'b1',
            [
                { rowNumber: 2, surname: 'A', name: 'B', group: 'ce2-a' },
                { rowNumber: 3, surname: 'C', name: 'D', group: 'CM1-B' },
                { rowNumber: 4, surname: 'E', name: 'F', group: 'cm1-b ' },
            ],
            TODAY
        );
        expect(result.missingGroups).toEqual(['CM1-B']);
        expect(result.rows[0].warnings).toEqual([]);
        expect(result.rows[1].warnings).toEqual(['Groupe « CM1-B » inexistant']);
    });

    it('reports the capacity left for the valid rows', async () => {
        const result = await validateImport('b1', [{ rowNumber: 2, surname: 'A', name: 'B' }], TODAY);
        expect(result.capacity).toEqual({ limit: 300, current: 120, remaining: 180, packName: 'Pro' });
    });

    it('rejects more than MAX_IMPORT_ROWS rows and malformed input', async () => {
        const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ rowNumber: i + 2, surname: 'A', name: 'B' }));
        await expect(validateImport('b1', rows, TODAY)).rejects.toThrow(`Maximum ${MAX_IMPORT_ROWS} lignes par import`);
        await expect(validateImport('b1', 'nope' as any, TODAY)).rejects.toThrow('Rows must be a non-empty list');
        await expect(validateImport('b1', [], TODAY)).rejects.toThrow('Rows must be a non-empty list');
        await expect(validateImport('b1', [{ surname: 'A' } as any], TODAY)).rejects.toThrow('Each row needs a rowNumber');
    });
});

describe('commitImport', () => {
    beforeEach(() => {
        (prisma.student.create as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({ id: `s-${data.surname}` }));
        (prisma.group.create as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({ id: `g-${data.name}` }));
        (assertStudentCapacity as jest.Mock).mockResolvedValue(undefined);
    });

    const ROWS = [
        { rowNumber: 2, surname: 'Alaoui', name: 'Sara', group: 'ce2-a', schoolLevel: 'Primaire' },
        { rowNumber: 3, surname: 'Bennani', name: 'Omar', birthDate: '05/03/2015' }, // duplicate in DB
        { rowNumber: 4, surname: 'Idrissi', name: 'Adam', group: 'CM1-B', schoolLevel: 'Primaire' },
        { rowNumber: 5, surname: '', name: 'Bad' }, // error
    ];

    it('checks capacity for the valid rows before writing anything', async () => {
        (assertStudentCapacity as jest.Mock).mockRejectedValueOnce(
            new StudentLimitError({ limit: 100, current: 99, adding: 2, packName: 'Essentiel' })
        );
        await expect(commitImport('b1', ROWS, false, TODAY)).rejects.toBeInstanceOf(StudentLimitError);
        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 2);
        expect(prisma.student.create).not.toHaveBeenCalled();
        expect(prisma.group.create).not.toHaveBeenCalled();
    });

    it('creates valid students with tokens and their existing group, and no inscription or payment', async () => {
        const result = await commitImport('b1', ROWS, false, TODAY);

        expect(prisma.student.create).toHaveBeenCalledTimes(2);
        const first = (prisma.student.create as jest.Mock).mock.calls[0][0].data;
        expect(first).toEqual({
            branchId: 'b1',
            surname: 'Alaoui',
            name: 'Sara',
            schoolLevel: 'Primaire',
            active: true,
            accessTokenHash: expect.any(String),
            portalTokenHash: expect.any(String),
            groups: { connect: [{ id: 'g1' }] },
        });
        const second = (prisma.student.create as jest.Mock).mock.calls[1][0].data;
        expect(second.groups).toBeUndefined(); // CM1-B missing and not created
        expect(prisma.group.create).not.toHaveBeenCalled();
        expect((prisma as any).inscription).toBeUndefined();
        expect((prisma as any).payment).toBeUndefined();

        expect(result.counts).toEqual({ created: 2, duplicate: 1, error: 1 });
        expect(result.rows.map((row) => [row.rowNumber, row.status])).toEqual([
            [2, 'created'],
            [3, 'duplicate'],
            [4, 'created'],
            [5, 'error'],
        ]);
        expect(result.createdGroups).toEqual([]);
    });

    it('creates each missing group once, with the level of its first row, when asked', async () => {
        const result = await commitImport('b1', ROWS, true, TODAY);
        expect(prisma.group.create).toHaveBeenCalledTimes(1);
        expect(prisma.group.create).toHaveBeenCalledWith({
            data: { name: 'CM1-B', type: 'SOUTIEN', level: 'Primaire', branchId: 'b1' },
            select: { id: true },
        });
        const second = (prisma.student.create as jest.Mock).mock.calls[1][0].data;
        expect(second.groups).toEqual({ connect: [{ id: 'g-CM1-B' }] });
        expect(result.createdGroups).toEqual(['CM1-B']);
    });

    it('records a failing row as an error and goes on with the next ones', async () => {
        (prisma.student.create as jest.Mock)
            .mockRejectedValueOnce(new Error('boom'))
            .mockImplementationOnce(({ data }: any) => Promise.resolve({ id: `s-${data.surname}` }));
        const result = await commitImport('b1', ROWS, false, TODAY);
        expect(result.rows[0]).toMatchObject({ rowNumber: 2, status: 'error', errors: ["Échec de l'enregistrement"] });
        expect(result.rows[2]).toMatchObject({ rowNumber: 4, status: 'created' });
        expect(result.counts).toEqual({ created: 1, duplicate: 1, error: 2 });
    });
});
