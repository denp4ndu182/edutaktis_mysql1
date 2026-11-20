import { prisma } from './onboarding-test-prisma';

async function main() {
  const npsn = 'ONB-DIR-D01-261110';
  const institutionId = 'b39f44ff-4e00-4ded-b660-dc3c2d538b98';
  const adminId = 'b074b301-33d9-42ed-a9ae-287be581d9be';

  const institutions = await prisma.institution.findMany({
    where: { npsn },
    select: { id: true, npsn: true, namaResmi: true },
  });

  const memberships = await prisma.institutionMembership.findMany({
    where: { institutionId, userId: adminId },
    select: { id: true, role: true, status: true },
  });

  const creationAudits = await prisma.auditLog.findMany({
    where: {
      institutionId,
      action: 'PLATFORM_INSTITUTION_CREATED',
      resource: 'Institution',
    },
    select: { id: true, userId: true, action: true },
  });

  const duplicateName = await prisma.institution.count({
    where: { namaResmi: 'Institusi Duplikat FT-08' },
  });

  const checks: [string, boolean][] = [
    ['NPSN hanya memiliki satu institusi', institutions.length === 1],
    ['ID institusi tetap sama', institutions[0]?.id === institutionId],
    ['Membership School Admin tetap satu', memberships.length === 1],
    ['Role School Admin benar', memberships[0]?.role === 'SCHOOL_ADMIN'],
    ['Status membership ACTIVE', memberships[0]?.status === 'ACTIVE'],
    ['Audit pembuatan institusi tetap satu', creationAudits.length === 1],
    ['Tidak ada institusi duplikat berdasarkan nama', duplicateName === 0],
  ];

  console.log('===== FT-08C DATABASE VERIFICATION =====');

  for (const [name, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  }

  console.log('\nInstitution:', institutions);
  console.log('Membership:', memberships);
  console.log('Creation audit count:', creationAudits.length);
  console.log('Duplicate name count:', duplicateName);

  const failed = checks.filter(([, passed]) => !passed).length;
  console.log(`\nRESULT: ${checks.length - failed}/${checks.length} checks passed`);

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
