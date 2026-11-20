
import 'dotenv/config';

import {
  InstitutionRole,
  MembershipStatus,
} from '@prisma/client';

import * as readline from 'readline';
import * as argon2 from 'argon2';

import { prisma } from '../src/db/prisma';
import { withSuperAdminGuard } from '../src/security/superAdminGuard';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(query: string, hide = false): Promise<string> {
  if (!hide) {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  }

  if (
    !process.stdin.isTTY ||
    typeof process.stdin.setRawMode !== 'function'
  ) {
    throw new Error(
      'Input password tersembunyi memerlukan terminal interaktif.'
    );
  }

  process.stdout.write(query);

  return new Promise((resolve, reject) => {
    let password = '';

    const onData = (data: Buffer | string) => {
      const input = data.toString();

      for (const char of input) {
        if (char === '\r' || char === '\n') {
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          resolve(password);
          return;
        }

        if (char === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          reject(new Error('Input dibatalkan.'));
          return;
        }

        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
          continue;
        }

        password += char;
        process.stdout.write('*');
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'Bootstrap hanya boleh dijalankan pada environment development.'
    );
  }

  await prisma.$queryRaw`SELECT 1`;
  console.log('Database verification successful.');

  const institutions = await prisma.institution.findMany({
    orderBy: { namaResmi: 'asc' },
    select: {
      id: true,
      namaResmi: true,
      npsn: true,
    },
  });

  if (institutions.length === 0) {
    throw new Error(
      'Tidak ada institusi. Buat institusi terlebih dahulu.'
    );
  }

  console.log('\nAvailable Institutions:');

  institutions.forEach((institution, index) => {
    console.log(
      `${index + 1}: ${institution.namaResmi} (${institution.npsn})`
    );
  });

  const instIndex = Number.parseInt(
    await question('Select institution index: '),
    10
  );

  const institution = institutions[instIndex - 1];

  if (!institution) {
    throw new Error('Pilihan institusi tidak valid.');
  }

  const namaLengkap = (await question('Nama Lengkap: ')).trim();
  const email = (await question('Email: ')).trim().toLowerCase();
  const password = await question('Password: ', true);
  const passwordConfirm = await question('Konfirmasi Password: ', true);

  if (!namaLengkap || !email || !password) {
    throw new Error('Nama, email, dan password wajib diisi.');
  }

  if (password !== passwordConfirm) {
    throw new Error('Konfirmasi password tidak cocok.');
  }

  console.log(
    `\nReady to create Super Admin: ${namaLengkap} (${email}) for ${institution.namaResmi}`
  );

  const confirm = await question(
    'Type "CREATE FIRST SUPER ADMIN" to confirm: '
  );

  if (confirm !== 'CREATE FIRST SUPER ADMIN') {
    throw new Error('Konfirmasi gagal. Bootstrap dibatalkan.');
  }

  const passwordHash = await argon2.hash(password);

  const result = await withSuperAdminGuard(async (tx) => {
    // Pemeriksaan dilakukan di dalam transaksi SERIALIZABLE.
    // Membership SUPER_ADMIN apa pun statusnya akan memblokir bootstrap.
    const existingSuperAdmin =
      await tx.institutionMembership.findFirst({
        where: {
          role: InstitutionRole.SUPER_ADMIN,
        },
        select: {
          id: true,
        },
      });

    if (existingSuperAdmin) {
      throw new Error(
        'Bootstrap ditolak: membership SUPER_ADMIN sudah ada.'
      );
    }

    const institutionExists = await tx.institution.findUnique({
      where: { id: institution.id },
      select: { id: true },
    });

    if (!institutionExists) {
      throw new Error('Institusi tidak ditemukan.');
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error('Email sudah digunakan.');
    }

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        namaLengkap,
      },
      select: {
        id: true,
        email: true,
      },
    });

    await tx.institutionMembership.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
        role: InstitutionRole.SUPER_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
        action: 'BOOTSTRAP_SUPER_ADMIN_CREATED',
        resource: 'User',
        details: {
          email: user.email,
        },
      },
    });

    return {
      userId: user.id,
      email: user.email,
    };
  });

  console.log('\nBootstrap completed successfully.');
  console.log(`Super Admin email: ${result.email}`);
}

run()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error('\nBootstrap error:', message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
