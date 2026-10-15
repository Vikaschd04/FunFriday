import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedActivityCatalog } from './activity-catalog.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const count = await seedActivityCatalog(prisma);
  console.warn(`Seeded ${count} activity definitions`);
} finally {
  await prisma.$disconnect();
}
