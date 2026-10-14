import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin account...');

  // buat / update role admin
  await prisma.role.upsert({
    where: {
      id: 1,
    },
    update: {
      name: 'admin',
    },
    create: {
      id: 1,
      name: 'admin',
    },
  });

  // buat / update role user
  await prisma.role.upsert({
    where: {
      id: 2,
    },
    update: {
      name: 'user',
    },
    create: {
      id: 2,
      name: 'user',
    },
  });

  const hashedAdminPassword = await bcrypt.hash('password123', 10);
  const hashedUserPassword = await bcrypt.hash('password123', 10);

  // buat / update akun admin
  const admin = await prisma.user.upsert({
    where: {
      email: 'admin@test.com',
    },
    update: {
      username: 'admin',
      password: hashedAdminPassword,
      roleId: 1,
      isAdmin: true,
    },
    create: {
      email: 'admin@test.com',
      username: 'admin',
      password: hashedAdminPassword,
      roleId: 1,
      isAdmin: true,
    },
    include: {
      role: true,
    },
  });

  // buat / update akun user biasa
  const user = await prisma.user.upsert({
    where: {
      email: 'user@test.com',
    },
    update: {
      username: 'testuser',
      password: hashedUserPassword,
      roleId: 2,
      isAdmin: false,
    },
    create: {
      email: 'user@test.com',
      username: 'testuser',
      password: hashedUserPassword,
      roleId: 2,
      isAdmin: false,
    },
    include: {
      role: true,
    },
  });

  console.log('✅ Admin ready:', {
    email: admin.email,
    username: admin.username,
    roleId: admin.roleId,
    isAdmin: admin.isAdmin,
    role: admin.role.name,
  });

  console.log('✅ User ready:', {
    email: user.email,
    username: user.username,
    roleId: user.roleId,
    isAdmin: user.isAdmin,
    role: user.role.name,
  });
}

main()
  .catch((error) => {
    console.error('❌ Seed admin error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });