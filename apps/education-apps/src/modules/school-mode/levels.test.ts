import { CYCLES, isCycle, isLevelCode, levelFromText, levelsOfCycles, levelCycle } from './levels';

describe('level catalog', () => {
    it('lists the levels of the chosen cycles in school order', () => {
        expect(levelsOfCycles(['PRIMAIRE', 'PRESCOLAIRE'])).toEqual(['PS1', 'PS2', 'PS3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
        expect(levelsOfCycles([])).toEqual([]);
    });

    it('knows cycles and codes', () => {
        expect(CYCLES).toEqual(['PRESCOLAIRE', 'PRIMAIRE', 'COLLEGE', 'LYCEE']);
        expect(isCycle('COLLEGE')).toBe(true);
        expect(isCycle('CRECHE')).toBe(false);
        expect(isLevelCode('B2')).toBe(true);
        expect(isLevelCode('3AP')).toBe(false);
        expect(levelCycle('PS2')).toBe('PRESCOLAIRE');
    });

    it('reads the usual ways schools write a level', () => {
        expect(levelFromText('3AP')).toBe('P3');
        expect(levelFromText('3ème année primaire')).toBe('P3');
        expect(levelFromText('السنة الثالثة ابتدائي')).toBe('P3');
        expect(levelFromText('السنة الثانية روض')).toBe('PS2');
        expect(levelFromText('2ème année préscolaire')).toBe('PS2');
        expect(levelFromText('1AC')).toBe('C1');
        expect(levelFromText('Tronc commun')).toBe('TC');
        expect(levelFromText('2 Bac')).toBe('B2');
        expect(levelFromText('P5')).toBe('P5');
        expect(levelFromText('Collège')).toBeNull(); // a cycle, not a level
        // hamza and harakat variants schools type in Excel
        expect(levelFromText('السنة الأُولى إعدادي')).toBe('C1');
        expect(levelFromText('السنة الثانية إبتدائي')).toBe('P2');
        expect(levelFromText('الأولى باك')).toBe('B1');
    });
    it('does not take «التعليم الأولي» for an ordinal', () => {
        expect(levelFromText('السنة الثانية التعليم الأولي')).toBe('PS2');
        expect(levelFromText('المستوى الثالث من التعليم الأولي')).toBe('PS3');
    });

    it('uses the first ordinal written in the text', () => {
        expect(levelFromText('6ème année primaire groupe 1')).toBe('P6');
        expect(levelFromText('السنة الثانية ابتدائي القسم 1')).toBe('P2');
        expect(levelFromText('2ème année primaire - 1')).toBe('P2');
        expect(levelFromText('4ème année primaire (2)')).toBe('P4');
    });

    it('reads other common spellings', () => {
        expect(levelFromText('1 باك')).toBe('B1');
        expect(levelFromText('2 باك')).toBe('B2');
        expect(levelFromText('باك 2')).toBe('B2');
        expect(levelFromText('الأولى بكالوريا')).toBe('B1');
        expect(levelFromText('الثانية بكالوريا')).toBe('B2');
        expect(levelFromText('1APIC')).toBe('C1');
        expect(levelFromText('2APIC')).toBe('C2');
        expect(levelFromText('3APIC')).toBe('C3');
        for (const tc of ['TCS', 'TCT', 'TCL', 'TC Sciences']) expect(levelFromText(tc)).toBe('TC');
        expect(levelFromText('CP')).toBe('P1');
        expect(levelFromText('CE1')).toBe('P2');
        expect(levelFromText('CE2')).toBe('P3');
        expect(levelFromText('CM1')).toBe('P4');
        expect(levelFromText('CM2')).toBe('P5');
        expect(levelFromText('6ème')).toBeNull();
        expect(levelFromText('PS')).toBe('PS1');
        expect(levelFromText('Petite section')).toBe('PS1');
        expect(levelFromText('MS')).toBe('PS2');
        expect(levelFromText('Moyenne section')).toBe('PS2');
        expect(levelFromText('GS')).toBe('PS3');
        expect(levelFromText('Grande section')).toBe('PS3');
        expect(levelFromText('Maternelle grande section')).toBe('PS3');
        expect(levelFromText('P 3')).toBe('P3');
        expect(levelFromText('PS 2')).toBe('PS2');
    });
});
