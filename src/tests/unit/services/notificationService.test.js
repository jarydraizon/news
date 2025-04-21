const { sendEmail } = require('../../../services/notificationService');
const { logger } = require('../../../utils/logger');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockImplementation(mailOptions => {
      return Promise.resolve({
        messageId: 'test-message-id',
        envelope: {
          from: mailOptions.from,
          to: [mailOptions.to]
        }
      });
    })
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/message/test')
}));

// Import mocked nodemailer
const nodemailer = require('nodemailer');

describe('Notification Service', () => {
  // Store original environment
  const originalEnv = { ...process.env };
  
  // Reset environment and mocks after each test
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });
  
  describe('sendEmail', () => {
    test('should send an email in production environment', async () => {
      // Set up production environment
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'false';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASSWORD = 'password123';
      process.env.EMAIL_FROM = '"Test Service" <service@example.com>';
      
      // Email data
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };
      
      // Send the email
      const result = await sendEmail(emailData);
      
      // Verify transporter creation
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: '587',
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password123'
        }
      });
      
      // Verify sendMail was called with the right options
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"Test Service" <service@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      });
      
      // Verify result
      expect(result.messageId).toBe('test-message-id');
      
      // Verify test URL function was not called (production mode)
      expect(nodemailer.getTestMessageUrl).not.toHaveBeenCalled();
    });
    
    test('should create a test email in development environment', async () => {
      // Set up development environment
      process.env.NODE_ENV = 'development';
      process.env.ETHEREAL_USER = 'ethereal@example.com';
      process.env.ETHEREAL_PASSWORD = 'ethereal123';
      
      // Email data
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email - Dev',
        text: 'This is a development test email',
        html: '<p>This is a development test email</p>'
      };
      
      // Send the email
      const result = await sendEmail(emailData);
      
      // Verify transporter creation
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal@example.com',
          pass: 'ethereal123'
        }
      });
      
      // Verify sendMail was called
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      
      // Verify preview URL was logged
      expect(nodemailer.getTestMessageUrl).toHaveBeenCalledWith(result);
    });
    
    test('should use default "from" address if not provided', async () => {
      // Set up production environment but without EMAIL_FROM
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';
      delete process.env.EMAIL_FROM;
      
      // Email data
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email - Default From',
        text: 'Testing default from address'
      };
      
      // Send the email
      await sendEmail(emailData);
      
      // Verify sendMail was called with the default from address
      const mockTransporter = nodemailer.createTransport();
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Email Summary Service" <summary@example.com>',
          to: 'recipient@example.com'
        })
      );
    });
    
    test('should handle errors gracefully', async () => {
      // Mock sendMail to throw an error
      const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));
      nodemailer.createTransport.mockReturnValueOnce({
        sendMail: mockSendMail
      });
      
      // Email data
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Error Test',
        text: 'This email will fail'
      };
      
      // Expect the sendEmail function to throw
      await expect(sendEmail(emailData)).rejects.toThrow('SMTP error');
      
      // Verify error logging
      expect(logger.error).toHaveBeenCalledWith('Error sending email:', expect.any(Error));
    });
  });
}); 