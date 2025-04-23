const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { logger } = require('../utils/logger');

// Create a placeholder for our email service
let emailService = null;
let useMockTransport = process.env.NODE_ENV === 'test' || !process.env.RESEND_API_KEY;

// Initialize the email service
const initializeEmailService = () => {
  if (emailService) return emailService;

  // Check if Resend API key is available
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('Initializing Resend email service');
      emailService = new Resend(process.env.RESEND_API_KEY);
      
      logger.info('Resend email service initialized');
      useMockTransport = false;
      return emailService;
    } catch (error) {
      logger.error('Error initializing Resend:', error);
      console.error('Failed to initialize Resend:', error.message);
      useMockTransport = true;
    }
  } else {
    console.log('No Resend API key found, using mock email transport');
    useMockTransport = true;
  }

  // Create a mock email service if needed
  if (useMockTransport) {
    console.log('Creating mock email transport (emails will not be sent)');
    emailService = {
      emails: {
        send: async ({ from, to, subject, html, text }) => {
          console.log('----------------');
          console.log('MOCK EMAIL SENT:');
          console.log('To:', to);
          console.log('From:', from);
          console.log('Subject:', subject);
          console.log('Text:', text ? 'Text included' : 'No text body');
          console.log('HTML:', html ? 'HTML included' : 'No HTML body');
          console.log('----------------');
          
          return {
            id: 'mock-email-id-' + Date.now(),
            from: from,
            to: to,
            mock: true
          };
        }
      }
    };
  }
  
  return emailService;
};

// Send email function
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // Initialize email service if not already initialized
    const service = initializeEmailService();
    
    // Default from address
    const fromAddress = process.env.EMAIL_FROM || 'Newsletter Summary <onboarding@resend.dev>';
    
    console.log(`Attempting to send email to ${to} with subject: ${subject}`);
    
    // Convert HTML to text if text not provided
    if (!text && html) {
      text = html.replace(/<[^>]*>/g, '');
    }
    
    let result;
    
    // Send email using Resend
    if (!useMockTransport) {
      result = await service.emails.send({
        from: fromAddress,
        to: to,
        subject: subject,
        html: html,
        text: text
      });
      
      if (result.error) {
        throw new Error(result.error.message || 'Unknown error from Resend');
      }
      
      logger.info(`Email sent: ${result.id}`);
      console.log(`Email sent with ID: ${result.id}`);
    } else {
      // Use mock service
      result = await service.emails.send({
        from: fromAddress,
        to: to,
        subject: subject,
        html: html,
        text: text
      });
      
      logger.info(`Mock email sent: ${result.id}`);
      console.log(`Mock email sent with ID: ${result.id}`);
    }

    return result;
  } catch (error) {
    logger.error('Error sending email:', error);
    console.error('Error sending email:', error.message);
    
    // For development, return mock successful response despite the error
    if (process.env.NODE_ENV !== 'production') {
      console.log('Returning mock success response due to error');
      return {
        id: 'mock-fallback-id-' + Date.now(),
        mock: true,
        error: error.message
      };
    }
    
    throw error;
  }
};

module.exports = {
  sendEmail
}; 