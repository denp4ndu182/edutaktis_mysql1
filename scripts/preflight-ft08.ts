import { prisma } from '../src/db/prisma';

async function main() {
  const npsn = 'TEST-ONB-20261110-D01';
  const adminEmail = 'applicant-b@onboarding.test';

  const [institution, admin] = await Promise.all([
    prisma.institution.findUnique({
      where: { npsn },
      select: { id: true, npsn: true },
    }),
    prisma.user.findUnique({
      where: { email: adminEmail },
      select: {
        id: true,
        email: true,
        isActive: true,
        memberships: {
          select: {
            institutionId: true,
            role: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const checks = {
    npsnAvailable: institution === null,
    adminExists: admin !== null,
    adminActive: admin?.isActive === true,
    adminHasNoMembership: admin?.memberships.length === 0,
  };

  console.log('===== FT-08 PREFLIGHT =====');

  for (const [key, value] of Object.entries(checks)) {
    console.log(`${value ? 'PASS' : 'FAIL'} | ${key}`);
  }

  console.log('\n===== FIXTURE DETAILS =====');
  console.log(JSON.stringify({
    institution,
    admin,
  }, null, 2));

  if (!Object.values(checks).every(Boolean)) {
    process.exitCode = 1;
  } else {
    console.log('\nFT-08 PREFLIGHT: READY');
  }
}

main()
  .catch((error) => {
    console.error('PREFLIGHT ERROR:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
