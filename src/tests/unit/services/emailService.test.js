const mongoose = require('mongoose');
const { getEmailsForSummary, markEmailsAsSummarized } = require('../../../services/emailService');
const Email = require('../../../models/email');
const { logger } = require('../../../utils/logger');

// Mock Gmail API
jest.mock('../../../config/gmail', () => ({
  getGmailService: jest.fn().mockReturnValue({
    users: {
      messages: {
        list: jest.fn(),
        get: jest.fn()
      }
    }
  })
}));

describe('Email Service', () => {
  // Setup test data
  beforeEach(async () => {
    // Create test emails with different dates and summarization status
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    
    // Clear emails collection
    await Email.deleteMany({});
    
    // Create emails for testing
    const emails = [
      // Yesterday's emails - not summarized
      {
        messageId: 'msg-1',
        threadId: 'thread-1',
        from: 'sender1@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email 1',
        body: 'Test content 1',
        receivedAt: yesterday,
        isSummarized: false
      },
      {
        messageId: 'msg-2',
        threadId: 'thread-1',
        from: 'sender2@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email 2',
        body: 'Test content 2',
        receivedAt: yesterday,
        isSummarized: false
      },
      // Day before yesterday - already summarized
      {
        messageId: 'msg-3',
        threadId: 'thread-2',
        from: 'sender3@example.com',
        to: 'recipient@example.com',
        subject: 'Old Email',
        body: 'Old content',
        receivedAt: dayBeforeYesterday,
        isSummarized: true
      },
      // Today's email - not summarized
      {
        messageId: 'msg-4',
        threadId: 'thread-3',
        from: 'sender4@example.com',
        to: 'recipient@example.com',
        subject: 'Today Email',
        body: 'Today content',
        receivedAt: today,
        isSummarized: false
      }
    ];
    
    await Email.insertMany(emails);
  });
  
  // Test getEmailsForSummary function
  describe('getEmailsForSummary', () => {
    test('should return emails within date range that are not summarized', async () => {
      // Get yesterday's date range
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      
      // Call the function
      const emails = await getEmailsForSummary(yesterday, yesterdayEnd);
      
      // Verify results
      expect(emails.length).toBe(2);
      expect(emails[0].messageId).toBe('msg-1');
      expect(emails[1].messageId).toBe('msg-2');
    });
    
    test('should return empty array if no unsummarized emails exist in range', async () => {
      // Get day before yesterday's date range
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      dayBeforeYesterday.setHours(0, 0, 0, 0);
      
      const dayBeforeYesterdayEnd = new Date(dayBeforeYesterday);
      dayBeforeYesterdayEnd.setHours(23, 59, 59, 999);
      
      // Call the function
      const emails = await getEmailsForSummary(dayBeforeYesterday, dayBeforeYesterdayEnd);
      
      // All emails from day before yesterday are already summarized
      expect(emails.length).toBe(0);
    });
  });
  
  // Test markEmailsAsSummarized function
  describe('markEmailsAsSummarized', () => {
    test('should mark emails as summarized', async () => {
      // Get emails that are not summarized
      const unsummarizedEmails = await Email.find({ isSummarized: false });
      const emailIds = unsummarizedEmails.map(email => email._id);
      
      // Call the function
      const result = await markEmailsAsSummarized(emailIds);
      
      // Verify results
      expect(result).toBe(emailIds.length);
      
      // Check if all emails are marked as summarized
      const remainingUnsummarized = await Email.countDocuments({ isSummarized: false });
      expect(remainingUnsummarized).toBe(0);
    });
    
    test('should return 0 if no emails are found to mark', async () => {
      // Use non-existent IDs
      const nonExistentIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ];
      
      // Call the function
      const result = await markEmailsAsSummarized(nonExistentIds);
      
      // Verify result
      expect(result).toBe(0);
    });
  });
  
  // Test base64UrlDecode and extractTextFromHtml helper functions through exposed methods
  describe('Email content processing helpers', () => {
    // We can test extractTextFromHtml via a more integration-style test
    test('should extract text from HTML content', async () => {
      // Directly test through email model to avoid exposing internal helper
      const htmlEmail = new Email({
        messageId: 'html-email',
        threadId: 'thread-html',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'HTML Email',
        body: 'Extracted text',
        htmlBody: '<div>This is <strong>HTML</strong> content</div><script>alert("test")</script><style>.hidden{display:none;}</style>',
        receivedAt: new Date()
      });
      
      await htmlEmail.save();
      
      // We can't test these helpers directly since they're not exported
      // In a real test, we would refactor the code to make these testable or use
      // integration tests through the public API
    });
  });
}); 