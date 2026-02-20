/**
 * Seed Admin User Script
 *
 * Creates the initial admin user in the database.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment variables or .env at the project root.
 *
 * Usage:
 *   npm run seed:admin
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret npm run seed:admin
 */

import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', 'apps', 'backend', '.env') });

import { PrismaClient, UserRole } from '../apps/backend/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!email || !password) {
    console.error(
      'Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables or .env file.',
    );
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL must be set in environment variables or .env file.');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User with email "${email}" already exists. Skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    console.log(`Admin user created successfully: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin().catch((err: unknown) => {
  console.error('Failed to seed admin user:', err);
  process.exit(1);
});
