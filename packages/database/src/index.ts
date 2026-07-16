import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Prisma client singleton.
 *
 * In development, the module-level `PrismaClient` instance is stored on
 * `globalThis` so that hot-reloading (e.g. Next.js / Vite HMR) does not
 * create a new database connection on every reload.
 */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { PrismaClient };
export * from '@prisma/client';
