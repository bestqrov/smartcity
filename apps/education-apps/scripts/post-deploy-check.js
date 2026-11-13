/* eslint-disable no-console */
// Read-only production checks after a deploy. Prints no secret values (only "set"/"missing"),
// except freshly generated VAPID keys when they are missing, so they can be pasted into Coolify.
// Usage: node scripts/post-deploy-check.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const ok = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const bad = (msg) => console.log(`  ❌ ${msg}`);
const isSet = (name) => typeof process.env[name] === 'string' && process.env[name].trim() !== '';

async function checkEnv() {
    console.log('\n[Environment]');
    for (const name of ['DATABASE_URL', 'JWT_SECRET']) (isSet(name) ? ok : bad)(`${name}: ${isSet(name) ? 'set' : 'MISSING'}`);

    const vapid = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
    const missing = vapid.filter((name) => !isSet(name));
    if (missing.length === 0) {
        ok('Push notifications (VAPID): configured');
    } else {
        bad(`Push notifications: missing ${missing.join(', ')}`);
        try {
            const keys = require('web-push').generateVAPIDKeys();
            console.log('\n     Add these 3 variables to the backend in Coolify (Environment Variables), then redeploy.');
            console.log('     Generate them ONCE and keep them: changing them later disables every parent\'s subscription.');
            console.log(`     VAPID_PUBLIC_KEY=${keys.publicKey}`);
            console.log(`     VAPID_PRIVATE_KEY=${keys.privateKey}`);
            console.log('     VAPID_SUBJECT=mailto:contact@votre-domaine.ma\n');
        } catch (error) {
            warn(`could not generate keys here (${error.message}); run: npx web-push generate-vapid-keys`);
        }
    }

    const worker = process.env.OUTBOX_WORKER;
    ok(`Notification worker: ${worker === '0' ? 'DISABLED on this instance (OUTBOX_WORKER=0)' : 'enabled'} — keep it enabled on exactly ONE instance`);
}

async function checkEvolution() {
    console.log('\n[WhatsApp automatique (Evolution API)]');
    if (!isSet('EVOLUTION_API_URL') || !isSet('EVOLUTION_API_KEY')) {
        warn('not configured (optional): schools keep the manual WhatsApp buttons');
        return;
    }
    const base = process.env.EVOLUTION_API_URL.replace(/\/+$/, '');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${base}/instance/fetchInstances`, {
            headers: { apikey: process.env.EVOLUTION_API_KEY },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) ok(`reachable, API key accepted (HTTP ${res.status})`);
        else if (res.status === 401 || res.status === 403) bad(`reachable but the API key is refused (HTTP ${res.status})`);
        else warn(`reachable, unexpected answer HTTP ${res.status}`);
    } catch (error) {
        bad(`not reachable: ${error.name === 'AbortError' ? 'timeout after 10 s' : error.message}`);
    }
}

async function checkData(prisma) {
    console.log('\n[Database]');
    const [schools, upgrades, outbox, channels] = await Promise.all([
        prisma.school.findMany({ include: { pack: true, branches: { select: { id: true } } } }),
        prisma.packUpgrade.count().catch(() => null),
        prisma.outboundMessage.count({ where: { status: 'PENDING' } }).catch(() => null),
        prisma.whatsappChannel.count({ where: { status: 'CONNECTED' } }).catch(() => null),
    ]);
    ok(`connected — ${schools.length} school(s)`);
    if (upgrades === null || outbox === null || channels === null) {
        bad('new collections not readable: did step 1 (prisma db push) succeed?');
    } else {
        ok(`pack upgrades: ${upgrades} · pending notifications: ${outbox} · schools with WhatsApp connected: ${channels}`);
    }

    console.log('\n[Schools over their pack student limit]');
    let over = 0;
    for (const school of schools) {
        const limit = school.pack ? school.pack.maxStudents : null;
        if (limit === null || limit === undefined) continue;
        const count = await prisma.student.count({
            where: { active: true, branchId: { in: school.branches.map((branch) => branch.id) } },
        });
        if (count > limit) {
            over += 1;
            warn(`${school.name}: ${count} students for ${limit} allowed (pack ${school.pack.name}) — blocked from adding students until it upgrades`);
        }
    }
    if (over === 0) ok('none');
}

(async () => {
    console.log('ArwaEduc — post-deploy checks');
    await checkEnv();
    await checkEvolution();
    const prisma = new PrismaClient();
    try {
        await checkData(prisma);
    } catch (error) {
        bad(`database check failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
    console.log('\nDone.');
})();
