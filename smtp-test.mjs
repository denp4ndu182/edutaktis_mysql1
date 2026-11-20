import nodemailer from 'nodemailer';
import readline from 'node:readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let transporter;

try {
  const recipient = (
    await rl.question('Email penerima: ')
  ).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Format email tidak valid');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });

  const info = await transporter.sendMail({
    from: {
      name: 'EduTaktis',
      address: process.env.MAIL_FROM
    },
    to: recipient,
    subject: 'Pengujian SMTP EduTaktis',
    text: 'Email pengujian SMTP EduTaktis melalui Rumahweb.',
    html: '<h2>EduTaktis SMTP Test</h2><p>Pengiriman email pengujian melalui Rumahweb.</p>'
  });

  console.log('PASS: Email diterima oleh server SMTP.');
  console.log('Message ID:', info.messageId);
  console.log('Accepted:', info.accepted.length);
  console.log('Rejected:', info.rejected.length);

  if (info.accepted.length === 0) {
    throw new Error('Server tidak menerima alamat penerima.');
  }

} catch (error) {
  console.error('FAIL:', error.code || 'UNKNOWN');
  console.error('Message:', error.message);
  process.exitCode = 1;
} finally {
  transporter?.close();
  rl.close();
}
