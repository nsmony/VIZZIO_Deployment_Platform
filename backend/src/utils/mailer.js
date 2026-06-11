import nodemailer from 'nodemailer';

let transporter;

function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: use Ethereal for local dev
  return nodemailer.createTestAccount().then((testAccount) =>
    nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  );
}

export async function getTransporter() {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
}

export async function sendInviteEmail(to, inviteUrl) {
  const t = await getTransporter();
  const html = `
    <p>Hello,</p>
    <p>You have been invited to join VIZZIO. Click the button below to accept the invitation and set your password. The link expires in 24 hours.</p>
    <p><a href="${inviteUrl}" style="background:#1f8ef1;color:#fff;padding:10px 14px;border-radius:4px;text-decoration:none;">Accept invitation</a></p>
    <p>If that doesn't work, paste this URL into your browser:</p>
    <p>${inviteUrl}</p>
    <p>— VIZZIO Team</p>
  `;

  const info = await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@vizzio.example',
    to,
    subject: 'You are invited to VIZZIO',
    html,
  });

  // If using Ethereal, return preview URL for dev
  if (nodemailer.getTestMessageUrl && info) {
    return nodemailer.getTestMessageUrl(info) || null;
  }
  return null;
}
