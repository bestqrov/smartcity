/*
 * Create a SUPER_ADMIN, or reset the password of an existing one.
 * Plain JavaScript on purpose: runs on the server without ts-node or a build.
 *
 * Usage (from apps/education-apps, e.g. in the Coolify terminal of education-backend):
 *   SUPER_ADMIN_EMAIL='you@example.com' SUPER_ADMIN_PASSWORD='a-long-password' node scripts/create-super-admin.js
 *
 * Credentials come from environment variables only: never write them in this file.
 * Safety: if the email belongs to a non-super-admin account (owner, secretary, sales agent…),
 * the script refuses instead of turning that account into a super admin.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || '';
const name = (process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();

const fail = (message) => {
    console.error(`❌ ${message}`);
    process.exit(1);
};

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Set SUPER_ADMIN_EMAIL to a valid email.');
if (password.length < 8) fail('Set SUPER_ADMIN_PASSWORD (at least 8 characters).');

const prisma = new PrismaClient();

(async () => {
    const hashed = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
        await prisma.user.create({ data: { email, password: hashed, name, role: 'SUPER_ADMIN' } });
        console.log(`✅ Super admin created: ${email}`);
        return;
    }
    if (existing.role !== 'SUPER_ADMIN') {
        fail(`${email} already belongs to a ${existing.role} account. Use another email.`);
    }
    await prisma.user.update({ where: { id: existing.id }, data: { password: hashed } });
    console.log(`✅ Password updated for super admin: ${email}`);
})()
    .catch((error) => {
        console.error('❌', error.message || error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
