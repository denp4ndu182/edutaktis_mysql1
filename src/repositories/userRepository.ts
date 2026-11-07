import { prisma } from '../db/prisma';
import { Prisma, User } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async listAll(limit = 100): Promise<User[]> {
    return prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const userRepository = new UserRepository();
