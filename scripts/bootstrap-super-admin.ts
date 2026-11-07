import { PrismaClient, InstitutionRole, MembershipStatus } from '@prisma/client';
import * as readline from 'readline';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(query: string, hide = false): Promise<string> {
  return new Promise((resolve) => {
    if (hide) {
      process.stdout.write(query);
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', (data) => {
        const char = data.toString();
        if (char === '\r' || char === '\n') {
          process.stdout.write('\n');
          process.stdin.setRawMode(false);
          process.stdin.removeAllListeners('data');
          resolve(password);
        } else if (char === '\x08') {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        } else {
          password += char;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(query, resolve);
    }
  });
}

async function run() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('This script can only be run in development environment.');
    }

    const dbProvider = await prisma.$queryRaw`SELECT @@datadir as datadir`;
    console.log('Database verification successful.');

    const existingSuperAdmins = await prisma.institutionMembership.findMany({
      where: { role: InstitutionRole.SUPER_ADMIN }
    });

    if (existingSuperAdmins.length > 0) {
      console.error('Bootstrap already completed. Super Admin account exists.');
      process.exit(1);
    }

    const institutions = await prisma.institution.findMany();
    if (institutions.length === 0) {
      console.error('No institutions found. Create an institution first.');
      process.exit(1);
    }

    console.log('Available Institutions:');
    institutions.forEach((inst, i) => console.log(`${i + 1}: ${inst.namaResmi} (${inst.npsn})`));
    const instIndex = await question('Select institution index: ');
    const institution = institutions[parseInt(instIndex) - 1];
    
    if (!institution) {
      console.error('Invalid institution selection.');
      process.exit(1);
    }

    const namaLengkap = await question('Nama Lengkap: ');
    const email = await question('Email: ');
    const password = await question('Password: ', true);
    const passwordConfirm = await question('Konfirmasi Password: ', true);

    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('Email already exists.');
    }

    console.log(`\nReady to create Super Admin: ${namaLengkap} (${email}) for ${institution.namaResmi}`);
    const confirm = await question('Type "CREATE FIRST SUPER ADMIN" to confirm: ');

    if (confirm !== 'CREATE FIRST SUPER ADMIN') {
      console.error('Confirmation failed. Aborting.');
      process.exit(1);
    }

    const passwordHash = await argon2.hash(password);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          namaLengkap,
        }
      });

      await tx.institutionMembership.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          role: InstitutionRole.SUPER_ADMIN,
          status: MembershipStatus.ACTIVE,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          action: 'BOOTSTRAP_SUPER_ADMIN_CREATED',
          resource: 'User',
          details: { email },
        }
      });
    });

    console.log('\nSuccess: Super Admin account created.');
    process.exit(0);
  } catch (err: any) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

run();
