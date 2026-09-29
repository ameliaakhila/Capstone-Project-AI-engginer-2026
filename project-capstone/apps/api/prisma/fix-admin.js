import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // pastikan role admin ada
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

  // pastikan role user ada
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

  // cari admin berdasarkan email
  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: 'admin@test.com',
    },
  });

  let admin;

  if (existingAdmin) {
    admin = await prisma.user.update({
      where: {
        email: 'admin@test.com',
      },
      data: {
        username: 'admin',
        password: hashedPassword,
        roleId: 1,
        isAdmin: true,
      },
      include: {
        role: true,
      },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        username: 'admin',
        password: hashedPassword,
        roleId: 1,
        isAdmin: true,
      },
      include: {
        role: true,
      },
    });
  }

  console.log('✅ Admin berhasil diperbaiki:');
  console.log({
    email: admin.email,
    username: admin.username,
    roleId: admin.roleId,
    isAdmin: admin.isAdmin,
    role: admin.role.name,
    password: 'password123',
  });
}

main()
  .catch((error) => {
    console.error('❌ Fix admin error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });