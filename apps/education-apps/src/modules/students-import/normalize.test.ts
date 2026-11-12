// src/modules/students-import/normalize.test.ts
import { duplicateKeys, foldText, normalizeRow, parseImportDate, normalizePhone, splitFullName } from './normalize';

const TODAY = new Date('2026-11-12T12:00:00Z');

describe('parseImportDate', () => {
    it('reads dd/mm/yyyy, dd-mm-yyyy, d/m/yyyy and yyyy-mm-dd as UTC midnight', () => {
        expect(parseImportDate('05/03/2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('05-03-2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('5/3/2015', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
        expect(parseImportDate('2015-03-05', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
    });

    it('reads an Excel date serial', () => {
        expect(parseImportDate('42068', TODAY)).toEqual(new Date('2015-03-05T00:00:00Z'));
    });

    it('rejects impossible dates, years before 1950 and future dates', () => {
        expect(parseImportDate('31/02/2015', TODAY)).toBeNull();
        expect(parseImportDate('01/01/1949', TODAY)).toBeNull();
        expect(parseImportDate('01/01/2027', TODAY)).toBeNull();
        expect(parseImportDate('hier', TODAY)).toBeNull();
        expect(parseImportDate('12', TODAY)).toBeNull();
    });
});

describe('normalizePhone', () => {
    it('turns Moroccan international forms into 0X…', () => {
        expect(normalizePhone('+212 6 12 34 56 78')).toEqual({ value: '0612345678', moroccan: true });
        expect(normalizePhone('00212712345678')).toEqual({ value: '0712345678', moroccan: true });
        expect(normalizePhone('212512345678')).toEqual({ value: '0512345678', moroccan: true });
        expect(normalizePhone('06.12.34.56.78')).toEqual({ value: '0612345678', moroccan: true });
    });

    it('keeps other numbers as typed and flags them', () => {
        expect(normalizePhone('+33 6 12 34 56 78')).toEqual({ value: '+33 6 12 34 56 78', moroccan: false });
        expect(normalizePhone('612345678')).toEqual({ value: '612345678', moroccan: false });
    });
});

describe('splitFullName', () => {
    it('takes the first word as surname and the rest as name', () => {
        expect(splitFullName('  EL AMRANI   Yasmine ')).toEqual({ surname: 'EL', name: 'AMRANI Yasmine' });
        expect(splitFullName('Bennani Omar')).toEqual({ surname: 'Bennani', name: 'Omar' });
    });

    it('returns an empty name for a single word', () => {
        expect(splitFullName('Bennani')).toEqual({ surname: 'Bennani', name: '' });
    });
});

describe('foldText and duplicateKeys', () => {
    it('ignores case, accents and extra spaces', () => {
        expect(foldText('  Élodie   GARÇON ')).toBe('elodie garcon');
    });

    it('returns the Massar key and the name + birth date key when available', () => {
        expect(duplicateKeys({ massarNumber: 'j130000001', surname: 'A', name: 'B', birthDate: null })).toEqual(['m:J130000001']);
        expect(duplicateKeys({ massarNumber: null, surname: 'Bennani', name: 'Omar', birthDate: new Date('2015-03-05T00:00:00Z') })).toEqual([
            'n:bennani|omar|2015-03-05',
        ]);
        expect(duplicateKeys({ massarNumber: 'M1', surname: 'Bennani', name: 'Omar', birthDate: new Date('2015-03-05T00:00:00Z') })).toEqual([
            'm:M1',
            'n:bennani|omar|2015-03-05',
        ]);
        expect(duplicateKeys({ massarNumber: null, surname: 'Bennani', name: 'Omar', birthDate: null })).toEqual([]);
    });
});

describe('normalizeRow', () => {
    it('builds the student data from a valid row', () => {
        const result = normalizeRow(
            {
                rowNumber: 2,
                surname: ' Bennani ',
                name: 'Omar',
                birthDate: '05/03/2015',
                massarNumber: ' j130000001 ',
                cin: 'ab123',
                parentPhone: '+212612345678',
                group: ' CE2-A ',
                email: '',
            },
            TODAY
        );
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.data).toEqual({
            surname: 'Bennani',
            name: 'Omar',
            birthDate: new Date('2015-03-05T00:00:00Z'),
            massarNumber: 'J130000001',
            cin: 'AB123',
            parentPhone: '0612345678',
        });
        expect(result.group).toBe('CE2-A');
    });

    it('splits the full name when surname and name are not given', () => {
        const result = normalizeRow({ rowNumber: 3, fullName: 'Alaoui Sara' }, TODAY);
        expect(result.data).toMatchObject({ surname: 'Alaoui', name: 'Sara' });
        expect(result.errors).toEqual([]);
    });

    it('reports a missing surname or name, a bad date, a bad email and a too-long value', () => {
        const result = normalizeRow(
            { rowNumber: 4, surname: '', name: 'x'.repeat(101), birthDate: '32/13/2015', email: 'pas-un-email', address: 'y'.repeat(501) },
            TODAY
        );
        expect(result.errors).toEqual([
            'Nom manquant',
            'Prénom trop long (100 caractères max)',
            'Date de naissance invalide : 32/13/2015',
            'Email invalide : pas-un-email',
            'Adresse trop longue (500 caractères max)',
        ]);
    });

    it('warns about a non-Moroccan phone number without rejecting the row', () => {
        const result = normalizeRow({ rowNumber: 5, surname: 'A', name: 'B', phone: '+33612345678' }, TODAY);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual(['Téléphone élève non marocain, gardé tel quel : +33612345678']);
        expect(result.data.phone).toBe('+33612345678');
    });

    it('ignores unknown keys', () => {
        const result = normalizeRow({ rowNumber: 6, surname: 'A', name: 'B', password: 'x', branchId: 'evil' } as any, TODAY);
        expect(result.data).toEqual({ surname: 'A', name: 'B' });
    });
});
