import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super';
  const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin';
  const phone = process.env.SUPER_ADMIN_PHONE;

  if (!email || !password) {
    console.error(
      '❌ Missing SUPER_ADMIN_EMAIL and/or SUPER_ADMIN_PASSWORD environment variables.',
    );
    process.exit(1);
  }

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashPassword(password),
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email,
      passwordHash: hashPassword(password),
      firstName,
      lastName,
      phone,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ SuperAdmin ready: ${superAdmin.email}`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to create super admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
