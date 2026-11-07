import { prisma } from '../db/prisma';
import { Prisma, Institution } from '@prisma/client';

export class InstitutionRepository {
  async findById(id: string): Promise<Institution | null> {
    return prisma.institution.findUnique({
      where: { id },
    });
  }

  async findByNpsn(npsn: string): Promise<Institution | null> {
    return prisma.institution.findUnique({
      where: { npsn },
    });
  }

  async create(data: Prisma.InstitutionCreateInput): Promise<Institution> {
    return prisma.institution.create({
      data,
    });
  }

  async update(id: string, data: Prisma.InstitutionUpdateInput): Promise<Institution> {
    return prisma.institution.update({
      where: { id },
      data,
    });
  }

  async listAll(limit = 100): Promise<Institution[]> {
    return prisma.institution.findMany({
      take: limit,
      orderBy: { namaResmi: 'asc' },
    });
  }
}

export const institutionRepository = new InstitutionRepository();
