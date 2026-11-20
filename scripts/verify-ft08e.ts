import { prisma } from './onboarding-test-prisma';

async function main() {
  const npsn = 'ONB-AUTH-261110';
  const institutionName = 'Institusi Uji Unauthorized FT-08E';
  const applicantB = 'b074b301-33d9-42ed-a9ae-287be581d9be';

  const [byNpsn, byName, memberships, auditLogs] = await Promise.all([
    prisma.institution.count({ where: { npsn } }),
    prisma.institution.count({ where: { namaResmi: institutionName } }),
    prisma.institutionMembership.findMany({
      where: { userId: applicantB },
      select: {
        institutionId: true,
        role: true,
        status: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        action: 'UNAUTHORIZED_SUPER_ADMIN_ATTEMPT',
        userId: applicantB,
        resource: '/api/platform/institutions',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        action: true,
        resource: true,
        userId: true,
        details: true,
        createdAt: true,
      },
    }),
  ]);

  const targetMemberships = await prisma.institutionMembership.count({
    where: {
      userId: applicantB,
      institution: { npsn },
    },
  });

  const checks = [
    ['Institusi dengan NPSN pengujian tidak tercipta', byNpsn === 0],
    ['Institusi dengan nama pengujian tidak tercipta', byName === 0],
    [
      'Applicant B tetap hanya memiliki membership sebelumnya',
      memberships.length === 1 &&
        memberships[0].institutionId ===
          'b39f44ff-4e00-4ded-b660-dc3c2d538b98' &&
        memberships[0].role === 'SCHOOL_ADMIN' &&
        memberships[0].status === 'ACTIVE',
    ],
    [
      'Tidak ada membership untuk institusi pengujian',
      targetMemberships === 0,
    ],
    [
      'Audit penolakan Super Admin tercatat',
      auditLogs.length >= 1,
    ],
  ];

  console.log('\n===== FT-08E DATABASE VERIFICATION =====');
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${label}`);
  }

  console.log('\nJumlah institusi berdasarkan NPSN:', byNpsn);
  console.log('Jumlah institusi berdasarkan nama:', byName);
  console.log('Membership Applicant B:', JSON.stringify(memberships, null, 2));
  console.log('Audit penolakan terbaru:', JSON.stringify(auditLogs, null, 2));

  const passedCount = checks.filter(([, passed]) => passed).length;
  console.log(`\nHASIL: ${passedCount}/${checks.length} pemeriksaan lulus`);

  if (passedCount !== checks.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('VERIFICATION ERROR:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
