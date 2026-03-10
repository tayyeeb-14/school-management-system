const nodemailer = require('nodemailer');

let transporter;
let testAccountInfo = null;

async function initTransport() {
  if (transporter) return { transporter, testAccountInfo };

  // If SMTP env vars provided, use real SMTP (Gmail/SendGrid/etc.)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE === 'true') || false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    return { transporter, testAccountInfo: null };
  }

  // Otherwise create Ethereal test account for dev
  const testAccount = await nodemailer.createTestAccount();
  testAccountInfo = testAccount;

  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });

  return { transporter, testAccountInfo };
}

async function sendOtpEmail(to, otp) {
  const { transporter, testAccountInfo } = await initTransport();

  const mailOptions = {
    from: process.env.FROM_EMAIL || (testAccountInfo ? testAccountInfo.user : process.env.SMTP_USER),
    to,
    subject: 'Your password reset OTP',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
  };

  const info = await transporter.sendMail(mailOptions);

  // If Ethereal, provide preview URL; otherwise return info only
  const previewUrl = testAccountInfo ? nodemailer.getTestMessageUrl(info) : null;
  return { info, previewUrl };
}

module.exports = { sendOtpEmail, initTransport };
