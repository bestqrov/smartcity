import { PrismaClient } from '@prisma/client';

// Typed as a plain PrismaClient so seeds/startup helpers that take `PrismaClient` keep working;
// the omit below is applied at runtime regardless.
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    // The teacher portal link hash must never leave the server, whatever query or include returns a teacher.
    omit: { teacher: { accessTokenHash: true } },
}) as unknown as PrismaClient;

export default prisma;
