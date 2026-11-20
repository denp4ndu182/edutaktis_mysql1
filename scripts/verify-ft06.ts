import { prisma } from '../src/db/prisma';

const REQUEST_ID = 'a6db46b0-b5b8-4dd6-8e3c-9620f2ae636c';
const APPLICANT_ID = 'b074b301-33d9-42ed-a9ae-287be581d9be';
const REVIEWER_ID = 'c6a26b98-3b37-4b50-9c86-d1bd1f9d9de3';

const EXPECTED_REASON =
  'Dokumen persyaratan institusi belum lengkap. Silakan lengkapi dokumen dan ajukan kembali.';

const TEST_NPSN = 'TEST-ONB-20261110-B';

async function main() {
  const request = await prisma.institutionRequest.findUnique({
    where: { id: REQUEST_ID },
    include: {
      requester: {
        select: { id: true, email: true },
      },
      reviewer: {
        select: { id: true, email: true },
      },
    },
  });

  const institution = await prisma.institution.findUnique({
    where: { npsn: TEST_NPSN },
    select: { id: true, npsn: true, namaResmi: true },
  });

  // Membership hanya diperiksa pada institusi dari pengajuan yang ditolak.
  // Applicant B dapat memiliki membership lain melalui proses direct creation FT-08.
  const membershipCount = await prisma.institutionMembership.count({
    where: {
      userId: APPLICANT_ID,
      institution: { npsn: TEST_NPSN },
    },
  });

  const auditCandidates = await prisma.auditLog.findMany({
    where: {
      action: 'INSTITUTION_REQUEST_REJECTED',
      resource: 'InstitutionRequest',
      userId: REVIEWER_ID,
    },
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      details: true,
      createdAt: true,
    },
  });

  const matchingAudits = auditCandidates.filter((log) => {
    if (
      typeof log.details !== 'object' ||
      log.details === null ||
      Array.isArray(log.details)
    ) {
      return false;
    }

    return log.details.requestId === REQUEST_ID;
  });

  const checks = {
    requestExists: request !== null,
    statusRejected: request?.status === 'REJECTED',
    applicantCorrect: request?.requesterUserId === APPLICANT_ID,
    requesterRelationCorrect:
      request?.requester.email === 'applicant-b@onboarding.test',
    reviewerCorrect: request?.reviewedBy === REVIEWER_ID,
    reviewerRelationCorrect:
      request?.reviewer?.email === 'superadmin@onboarding.test',
    rejectionReasonCorrect:
      request?.rejectionReason === EXPECTED_REASON,
    reviewedAtExists: request?.reviewedAt instanceof Date,
    institutionIdIsNull: request?.institutionId === null,
    noInstitutionCreated: institution === null,
    noMembershipAtRejectedInstitution: membershipCount === 0,
    exactlyOneRejectionAudit: matchingAudits.length === 1,
    auditActionCorrect:
      matchingAudits[0]?.action === 'INSTITUTION_REQUEST_REJECTED',
    auditReviewerCorrect:
      matchingAudits[0]?.userId === REVIEWER_ID,
  };

  console.log('\n===== FT-06 DATABASE VERIFICATION =====');

  for (const [name, passed] of Object.entries(checks)) {
    console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  }

  console.log('\n===== REQUEST SUMMARY =====');
  console.log(JSON.stringify(
    request
      ? {
          id: request.id,
          status: request.status,
          requester: request.requester.email,
          reviewer: request.reviewer?.email ?? null,
          reviewedAt: request.reviewedAt,
          institutionId: request.institutionId,
          rejectionReason: request.rejectionReason,
        }
      : null,
    null,
    2
  ));

  console.log('\n===== RELATED DATA =====');
  console.log(JSON.stringify({
    institutionWithTestNpsn: institution,
    applicantMembershipCount: membershipCount,
    matchingRejectionAuditCount: matchingAudits.length,
    matchingRejectionAudits: matchingAudits,
  }, null, 2));

  const passed = Object.values(checks).every(Boolean);

  console.log(
    passed
      ? '\nFT-06 DATABASE VERIFICATION: PASSED'
      : '\nFT-06 DATABASE VERIFICATION: FAILED'
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
