import { prisma } from './onboarding-test-prisma';

const INSTITUTION_ID = 'b39f44ff-4e00-4ded-b660-dc3c2d538b98';
const NPSN = 'ONB-DIR-D01-261110';

const SUPER_ADMIN_ID = 'c6a26b98-3b37-4b50-9c86-d1bd1f9d9de3';
const APPLICANT_B_ID = 'b074b301-33d9-42ed-a9ae-287be581d9be';

async function main() {
  const institution = await prisma.institution.findUnique({
    where: { npsn: NPSN },
  });

  const memberships = institution
    ? await prisma.institutionMembership.findMany({
        where: {
          institutionId: institution.id,
        },
        select: {
          id: true,
          userId: true,
          institutionId: true,
          role: true,
          status: true,
        },
      })
    : [];

  const initialAdminMembership = memberships.find(
    (membership) => membership.userId === APPLICANT_B_ID
  );

  const auditLogs = institution
    ? await prisma.auditLog.findMany({
        where: {
          userId: SUPER_ADMIN_ID,
          institutionId: institution.id,
          action: 'PLATFORM_INSTITUTION_CREATED',
          resource: 'Institution',
        },
        select: {
          id: true,
          userId: true,
          institutionId: true,
          action: true,
          resource: true,
          details: true,
          createdAt: true,
        },
      })
    : [];

  const checks = {
    institutionCreated: institution !== null,
    institutionIdMatches:
      institution?.id === INSTITUTION_ID,
    institutionNpsnCorrect:
      institution?.npsn === NPSN,
    initialAdminMembershipExists:
      initialAdminMembership !== undefined,
    initialAdminRoleCorrect:
      initialAdminMembership?.role === 'SCHOOL_ADMIN',
    initialAdminStatusActive:
      initialAdminMembership?.status === 'ACTIVE',
    exactlyOneMembership:
      memberships.length === 1,
    exactlyOneCreationAudit:
      auditLogs.length === 1,
    auditActorCorrect:
      auditLogs[0]?.userId === SUPER_ADMIN_ID,
    auditInstitutionCorrect:
      auditLogs[0]?.institutionId === INSTITUTION_ID,
  };

  console.log('\n===== FT-08A DATABASE VERIFICATION =====');

  for (const [name, passed] of Object.entries(checks)) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  }

  console.log('\n===== INSTITUTION =====');
  console.log(JSON.stringify(institution, null, 2));

  console.log('\n===== MEMBERSHIPS =====');
  console.log(JSON.stringify(memberships, null, 2));

  console.log('\n===== AUDIT LOG =====');
  console.log(JSON.stringify(auditLogs, null, 2));

  const passed = Object.values(checks).every(Boolean);

  console.log(
    passed
      ? '\nFT-08A DATABASE VERIFICATION: PASSED'
      : '\nFT-08A DATABASE VERIFICATION: FAILED'
  );

  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('VERIFICATION ERROR:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
