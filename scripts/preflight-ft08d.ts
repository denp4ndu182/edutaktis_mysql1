import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const inactiveUsers = await prisma.user.findMany({
    where: {
      isActive: false,
      email: { endsWith: '@onboarding.test' },
    },
    select: {
      id: true,
      email: true,
      isActive: true,
    },
  });

  console.log('===== FT-08D PREFLIGHT =====');
  console.log('Inactive onboarding fixtures:', inactiveUsers.length);
  console.log(inactiveUsers);
}

main()
  .catch((error) => {
    console.error('PREFLIGHT ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
