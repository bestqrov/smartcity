import { assertId } from './ids';

describe('assertId', () => {
    it.each([undefined, null, '', '  ', 123])('throws for %p', (value) => {
        expect(() => assertId('Student id', value)).toThrow('Student id is required');
    });

    it('passes a normal string', () => {
        expect(() => assertId('Student id', 'abc')).not.toThrow();
    });
});
