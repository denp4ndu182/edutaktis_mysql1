import { prisma } from './onboarding-test-prisma';

async function main() {
  const npsn = 'ONB-INACT-261110';
  const institutionName = 'Institusi Uji Admin Nonaktif';
  const inactiveUserId = '43cd0fbc-3f3d-4947-915d-916176179ecb';

  const [
    institutionCount,
    nameCount,
    inactiveUser,
    membershipCount,
    creationAudits,
  ] = await Promise.all([
    prisma.institution.count({ where: { npsn } }),

    prisma.institution.count({
      where: { namaResmi: institutionName },
    }),

    prisma.user.findUnique({
      where: { id: inactiveUserId },
      select: {
        id: true,
        isActive: true,
        email: true,
      },
    }),

    prisma.institutionMembership.count({
      where: { userId: inactiveUserId },
    }),

    prisma.auditLog.findMany({
      where: {
        action: 'PLATFORM_INSTITUTION_CREATED',
        resource: 'Institution',
      },
      select: {
        id: true,
        details: true,
      },
    }),
  ]);

  const matchingAudits = creationAudits.filter((audit) => {
    const details = audit.details;

    return (
      typeof details === 'object' &&
      details !== null &&
      !Array.isArray(details) &&
      'npsn' in details &&
      details.npsn === npsn
    );
  });

  const creationAuditCount = matchingAudits.length;

  const checks: [string, boolean][] = [
    ['Institusi berdasarkan NPSN tidak tercipta', institutionCount === 0],
    ['Institusi berdasarkan nama tidak tercipta', nameCount === 0],
    ['Fixture pengguna masih ditemukan', inactiveUser !== null],
    ['Fixture tetap nonaktif', inactiveUser?.isActive === false],
    ['Fixture tidak memiliki membership', membershipCount === 0],
    ['Tidak ada audit pembuatan institusi', creationAuditCount === 0],
  ];

  console.log('===== FT-08D-2 DATABASE VERIFICATION =====');

  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${label}`);
  }

  console.log('\nInactive user:', inactiveUser);
  console.log('Institution NPSN count:', institutionCount);
  console.log('Institution name count:', nameCount);
  console.log('Membership count:', membershipCount);
  console.log('Matching creation audit count:', creationAuditCount);

  const failed = checks.filter(([, passed]) => !passed).length;

  console.log(
    `\nRESULT: ${checks.length - failed}/${checks.length} checks passed`
  );

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('VERIFY ERROR:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
