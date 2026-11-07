import { prisma } from '../db/prisma';
import { Prisma, InstitutionMembership, InstitutionRole, MembershipStatus } from '@prisma/client';

export class MembershipRepository {
  async findByUserAndInstitution(
    userId: string,
    institutionId: string
  ): Promise<InstitutionMembership | null> {
    return prisma.institutionMembership.findUnique({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
    });
  }

  async listByUser(userId: string): Promise<
    (InstitutionMembership & {
      institution: {
        id: string;
        namaResmi: string;
        namaSingkat: string;
        npsn: string;
        jenjang: string;
      };
    })[]
  > {
    return prisma.institutionMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        institution: {
          select: {
            id: true,
            namaResmi: true,
            namaSingkat: true,
            npsn: true,
            jenjang: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async listByInstitution(institutionId: string): Promise<
    (InstitutionMembership & {
      user: {
        id: string;
        namaLengkap: string;
        email: string;
        nip: string | null;
      };
    })[]
  > {
    return prisma.institutionMembership.findMany({
      where: { institutionId },
      include: {
        user: {
          select: {
            id: true,
            namaLengkap: true,
            email: true,
            nip: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async create(data: Prisma.InstitutionMembershipCreateInput): Promise<InstitutionMembership> {
    return prisma.institutionMembership.create({
      data,
    });
  }

  async updateRole(
    userId: string,
    institutionId: string,
    role: InstitutionRole
  ): Promise<InstitutionMembership> {
    return prisma.institutionMembership.update({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      data: { role },
    });
  }

  async updateStatus(
    userId: string,
    institutionId: string,
    status: MembershipStatus
  ): Promise<InstitutionMembership> {
    return prisma.institutionMembership.update({
      where: {
        userId_institutionId: {
          userId,
          institutionId,
        },
      },
      data: { status },
    });
  }
}

export const membershipRepository = new MembershipRepository();
