const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

// Create reusable transporter object using SMTP transport
let transporter = null;

// Initialize the email transporter
const initializeTransporter = () => {
  if (transporter) return transporter;

  // In production, you would use real SMTP settings
  // For development, we can use ethereal for testing or a service like SendGrid
  if (process.env.NODE_ENV === 'production') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  } else {
    // For development/testing, create a test account on Ethereal
    // This would typically be done asynchronously when the app starts
    // but for simplicity we're using a synchronous approach here
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER || 'ethereal.user@ethereal.email',
        pass: process.env.ETHEREAL_PASSWORD || 'ethereal_password'
      }
    });
  }

  return transporter;
};

// Send email function
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Initialize or get transporter
    const emailTransporter = initializeTransporter();

    // Setup email data
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Email Summary Service" <summary@example.com>',
      to,
      subject,
      text,
      html
    };

    // Send mail
    const info = await emailTransporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    
    // For development, log the URL where the email can be previewed (if using Ethereal)
    if (process.env.NODE_ENV !== 'production' && info.messageId) {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail
}; 