const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.user.findFirst();
    console.log('✅ MongoDB connection OK');
  } catch (e) {
    console.error('❌ MongoDB connection failed:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
