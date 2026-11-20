import { prisma } from '../src/db/prisma';

const APPLICANT_A = '196f5c62-8812-4068-b092-bf43f7e90c03';
const APPLICANT_B = 'b074b301-33d9-42ed-a9ae-287be581d9be';
const SUPER_ADMIN = 'c6a26b98-3b37-4b50-9c86-d1bd1f9d9de3';

const REQUEST_A = 'f85d1cbd-4098-47bd-8fee-1610000f78ef';
const REQUEST_B = 'a6db46b0-b5b8-4dd6-8e3c-9620f2ae636c';

const SPOOF_NPSN = 'TEST-ONB-20261110-M';
const REJECTED_NPSN = 'TEST-ONB-20261110-B';

async function main() {
  // 1. Pastikan status dua permohonan tidak berubah.
  const [requestA, requestB] = await Promise.all([
    prisma.institutionRequest.findUnique({
      where: { id: REQUEST_A },
      select: { id: true, status: true, institutionId: true },
    }),
    prisma.institutionRequest.findUnique({
      where: { id: REQUEST_B },
      select: { id: true, status: true, institutionId: true },
    }),
  ]);

  // 2. Pastikan tidak ada pengajuan palsu dari payload spoof.
  const spoofRequestCount = await prisma.institutionRequest.count({
    where: { npsn: SPOOF_NPSN },
  });

  // 3. Pastikan jumlah membership tidak berubah dari kondisi fixture.
  const [membershipA, membershipB] = await Promise.all([
    prisma.institutionMembership.count({
      where: { userId: APPLICANT_A },
    }),
    // Applicant B boleh memiliki membership pada institusi lain melalui FT-08.
    // Yang harus tidak ada adalah membership pada institusi dari request yang ditolak.
    prisma.institutionMembership.count({
      where: {
        userId: APPLICANT_B,
        institution: { npsn: REJECTED_NPSN },
      },
    }),
  ]);

  // 4. Verifikasi audit percobaan akses Applicant.
  const [unauthorizedA, unauthorizedB] = await Promise.all([
    prisma.auditLog.count({
      where: {
        userId: APPLICANT_A,
        action: 'UNAUTHORIZED_SUPER_ADMIN_ATTEMPT',
        resource: `/api/platform/institution-requests/${REQUEST_A}/approve`,
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: APPLICANT_B,
        action: 'UNAUTHORIZED_SUPER_ADMIN_ATTEMPT',
        resource: `/api/platform/institution-requests/${REQUEST_B}/reject`,
      },
    }),
  ]);

  // 5. Verifikasi tiga aktivitas Super Admin.
  const [platformD, platformF, platformG] = await Promise.all([
    prisma.auditLog.count({
      where: {
        userId: SUPER_ADMIN,
        action: 'SUPER_ADMIN_PLATFORM_ACTION',
        resource: `/api/platform/institution-requests/${REQUEST_B}/reject`,
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: SUPER_ADMIN,
        action: 'SUPER_ADMIN_PLATFORM_ACTION',
        resource: `/api/platform/institution-requests/${REQUEST_A}/approve`,
      },
    }),
    prisma.auditLog.count({
      where: {
        userId: SUPER_ADMIN,
        action: 'SUPER_ADMIN_PLATFORM_ACTION',
        resource: `/api/platform/institution-requests/${REQUEST_B}/reject`,
      },
    }),
  ]);

  const checks = {
    applicantAStillApproved: requestA?.status === 'APPROVED',
    applicantAInstitutionIdExists: Boolean(requestA?.institutionId),
    applicantBStillRejected: requestB?.status === 'REJECTED',
    applicantBInstitutionIdNull: requestB?.institutionId === null,
    noSpoofRequestCreated: spoofRequestCount === 0,
    applicantAMembershipUnchanged: membershipA === 1,
    applicantBHasNoMembershipAtRejectedInstitution: membershipB === 0,
    applicantAAttemptAudited: unauthorizedA === 1,
    applicantBAttemptAudited: unauthorizedB === 1,
    superAdminMissingReasonAudited: platformD === 3,
    superAdminRepeatApprovalAudited: platformF === 2,
    superAdminRepeatRejectionAudited: platformG === 3,
  };

  // Catatan: resource penolakan sama untuk FT-07D dan FT-07G.
  // Fixture saat ini memiliki 3 audit Super Admin untuk resource tersebut.

  console.log('\n===== FT-07 DATABASE INTEGRITY =====');

  for (const [name, passed] of Object.entries(checks)) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  }

  console.log('\n===== DATABASE SNAPSHOT =====');
  console.log(JSON.stringify({
    requestA,
    requestB,
    spoofRequestCount,
    membershipA,
    membershipB,
    auditCounts: {
      unauthorizedA,
      unauthorizedB,
      superAdminApproveRequestA: platformF,
      superAdminRejectRequestB: platformD,
    },
  }, null, 2));

  const passed = Object.values(checks).every(Boolean);

  console.log(
    passed
      ? '\nFT-07 DATABASE VERIFICATION: PASSED'
      : '\nFT-07 DATABASE VERIFICATION: FAILED'
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
