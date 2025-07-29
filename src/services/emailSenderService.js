const nodemailer = require("nodemailer");

const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email with an HTML template
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 */
async function sendHtmlEmail({ to, subject, html }) {
  return smtpTransport.sendMail({
    from: process.env.SMTP_FROM || "Elysium <shubhojeet.official@gmail.com>",
    to,
    subject,
    html,
  });
}

module.exports = { sendHtmlEmail };
