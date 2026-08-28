import { generateRawToken, hashToken, verifyToken } from './accessToken';

describe('accessToken', () => {
    it('generates a url-safe token of sufficient length', () => {
        const token = generateRawToken();
        expect(token.length).toBeGreaterThanOrEqual(32);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates different tokens each call', () => {
        expect(generateRawToken()).not.toBe(generateRawToken());
    });

    it('hashes deterministically', () => {
        const token = generateRawToken();
        expect(hashToken(token)).toBe(hashToken(token));
    });

    it('verifyToken returns true for a matching raw token + hash', () => {
        const token = generateRawToken();
        const hash = hashToken(token);
        expect(verifyToken(token, hash)).toBe(true);
    });

    it('verifyToken returns false for a non-matching raw token', () => {
        const hash = hashToken(generateRawToken());
        expect(verifyToken('not-the-right-token', hash)).toBe(false);
    });
});
