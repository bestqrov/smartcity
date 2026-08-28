import crypto from 'crypto';

export const generateRawToken = (): string => {
    return crypto.randomBytes(32).toString('base64url');
};

export const hashToken = (rawToken: string): string => {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
};

export const verifyToken = (rawToken: string, storedHash: string): boolean => {
    const candidateHash = hashToken(rawToken);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
};
