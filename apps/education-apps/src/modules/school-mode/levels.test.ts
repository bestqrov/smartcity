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
    });
});
