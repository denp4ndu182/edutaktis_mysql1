
import nodemailer from 'nodemailer';

interface PasswordResetEmailOptions {
  recipient: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error('SMTP configuration is incomplete.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP port configuration is invalid.');
  }

  const secure =
    process.env.SMTP_SECURE === 'true' || port === 465;

  return { host, port, secure, user, pass, from };
}

export async function sendPasswordResetEmail(
  options: PasswordResetEmailOptions
): Promise<void> {
  const config = getSmtpConfig();

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error('APP_URL is not configured.');
  }

  const parsedAppUrl = new URL(appUrl);

  if (
    process.env.NODE_ENV === 'production' &&
    parsedAppUrl.protocol !== 'https:'
  ) {
    throw new Error('Production APP_URL must use HTTPS.');
  }

  const resetUrl = new URL(options.resetUrl);

  if (
    resetUrl.origin !== parsedAppUrl.origin ||
    resetUrl.pathname !== '/reset-password'
  ) {
    throw new Error('Password reset URL is not trusted.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  const expiry = options.expiresInMinutes ?? 60;

  try {
    await transporter.sendMail({
      from: {
        name: 'EduTaktis',
        address: config.from,
      },
      to: options.recipient,
      subject: 'Permintaan Reset Password EduTaktis',
      text: [
        'Kami menerima permintaan untuk mengatur ulang password akun EduTaktis Anda.',
        '',
        `Gunakan tautan berikut: ${resetUrl.toString()}`,
        '',
        `Tautan berlaku selama ${expiry} menit.`,
        'Jika Anda tidak meminta reset password, abaikan email ini.',
      ].join('\n'),
      html: `
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Reset Password EduTaktis</title>
          </head>
          <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
            <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;padding:32px">
              <h2 style="color:#0f766e;margin-top:0">Reset Password EduTaktis</h2>
              <p>Kami menerima permintaan untuk mengatur ulang password akun EduTaktis Anda.</p>
              <p style="margin:28px 0">
                <a href="${resetUrl.toString()}"
                   style="background:#0f766e;color:#ffffff;padding:14px 22px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">
                  Atur Ulang Password
                </a>
              </p>
              <p>Tautan ini hanya dapat digunakan satu kali dan berlaku selama ${expiry} menit.</p>
              <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
              <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="font-size:12px;color:#64748b">
                Email otomatis dari EduTaktis. Mohon tidak membalas email ini.
              </p>
            </div>
          </body>
        </html>
      `,
    });
  } finally {
    transporter.close();
  }
}
