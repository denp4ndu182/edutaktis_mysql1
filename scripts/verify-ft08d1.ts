import { prisma } from './onboarding-test-prisma';

async function main() {
  const npsn = 'ONB-MISS-261110';
  const name = 'Institusi Uji Admin Tidak Ditemukan';

  const institutionCount = await prisma.institution.count({
    where: { npsn },
  });

  const nameCount = await prisma.institution.count({
    where: { namaResmi: name },
  });

  const checks: [string, boolean][] = [
    ['Institusi dengan NPSN percobaan tidak tercipta', institutionCount === 0],
    ['Institusi dengan nama percobaan tidak tercipta', nameCount === 0],
  ];

  console.log('===== FT-08D-1 DATABASE VERIFICATION =====');

  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${label}`);
  }

  console.log(`\nInstitution NPSN count: ${institutionCount}`);
  console.log(`Institution name count: ${nameCount}`);

  const failed = checks.filter(([, passed]) => !passed).length;
  console.log(`RESULT: ${checks.length - failed}/${checks.length} checks passed`);

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
