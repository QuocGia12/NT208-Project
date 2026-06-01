import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const normalizeUsername = (value: string) => value.trim().toLowerCase();

async function main() {
  const username = normalizeUsername(process.env.ADMIN_USERNAME ?? 'admin');
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const avatar = process.env.ADMIN_AVATAR?.trim() || null;

  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      avatar,
      role: UserRole.ADMIN,
      coins: 999999,
      gems: 999999,
    },
    update: {
      passwordHash,
      avatar,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Admin account ready: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
