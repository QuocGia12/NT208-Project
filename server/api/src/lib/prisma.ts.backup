import { PrismaClient } from '@prisma/client';

declare global {
  var prismaClient: PrismaClient | undefined;
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);

export const prisma = global.prismaClient ?? new PrismaClient({
  log: ['query', 'error', 'warn']
});

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}
