const mongoose = require('mongoose');
const { createDailySummary, distributeSummary } = require('../../../services/summaryService');
const Email = require('../../../models/email');
const Summary = require('../../../models/summary');
const { logger } = require('../../../utils/logger');

// Mock dependencies
jest.mock('../../../services/emailService', () => ({
  getEmailsForSummary: jest.fn(),
  markEmailsAsSummarized: jest.fn(),
  fetchEmails: jest.fn()
}));

jest.mock('../../../config/openai', () => ({
  generateSummary: jest.fn(),
  categorizeEmails: jest.fn()
}));

jest.mock('../../../services/notificationService', () => ({
  sendEmail: jest.fn()
}));

// Import mocked modules
const { getEmailsForSummary, markEmailsAsSummarized } = require('../../../services/emailService');
const { generateSummary, categorizeEmails } = require('../../../config/openai');
const { sendEmail } = require('../../../services/notificationService');

describe('Summary Service', () => {
  // Set up test data before each test
  beforeEach(async () => {
    // Clear mock calls
    jest.clearAllMocks();
    
    // Clear database collections
    await Email.deleteMany({});
    await Summary.deleteMany({});
  });
  
  describe('createDailySummary', () => {
    test('should create a daily summary for emails', async () => {
      // Set up test data - date
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      
      // Mock emails to be returned by getEmailsForSummary
      const mockEmails = [
        {
          _id: new mongoose.Types.ObjectId(),
          messageId: 'msg-1',
          threadId: 'thread-1',
          from: 'sender1@example.com',
          to: 'recipient@example.com',
          subject: 'Test Email 1',
          body: 'Test content 1',
          receivedAt: date,
          isSummarized: false
        },
        {
          _id: new mongoose.Types.ObjectId(),
          messageId: 'msg-2',
          threadId: 'thread-1',
          from: 'sender2@example.com',
          to: 'recipient@example.com',
          subject: 'Test Email 2',
          body: 'Test content 2',
          receivedAt: date,
          isSummarized: false
        }
      ];
      
      // Set up mock return values
      getEmailsForSummary.mockResolvedValue(mockEmails);
      generateSummary.mockResolvedValueOnce('Batch summary for emails')
                      .mockResolvedValueOnce('Final combined summary of all emails');
      categorizeEmails.mockResolvedValue('Category 1: Work Emails\nCategory 2: Personal Emails');
      markEmailsAsSummarized.mockResolvedValue(mockEmails.length);
      
      // Call the function
      const summary = await createDailySummary(date);
      
      // Verify the function was called with correct parameters
      expect(getEmailsForSummary).toHaveBeenCalledWith(expect.any(Date), expect.any(Date));
      expect(generateSummary).toHaveBeenCalledTimes(2);
      expect(categorizeEmails).toHaveBeenCalled();
      expect(markEmailsAsSummarized).toHaveBeenCalledWith(mockEmails.map(email => email._id));
      
      // Verify the summary was created correctly
      expect(summary).toBeDefined();
      expect(summary.date.toDateString()).toBe(date.toDateString());
      expect(summary.content).toBe('Final combined summary of all emails');
      expect(summary.emailCount).toBe(mockEmails.length);
      expect(summary.emailIds.length).toBe(mockEmails.length);
      expect(summary.topicCategories.length).toBe(2);
    });
    
    test('should return existing summary if already exists for date', async () => {
      // Set up test data - date
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      
      // Create an existing summary
      const existingSummary = new Summary({
        date,
        content: 'Existing summary content',
        emailCount: 3,
        emailIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        topicCategories: [{ name: 'Existing', description: 'Existing Category' }]
      });
      
      await existingSummary.save();
      
      // Call the function
      const summary = await createDailySummary(date);
      
      // Verify that we got the existing summary back
      expect(summary._id.toString()).toBe(existingSummary._id.toString());
      expect(summary.content).toBe(existingSummary.content);
      
      // Verify that the email fetching function was not called
      expect(getEmailsForSummary).not.toHaveBeenCalled();
    });
    
    test('should return null if no emails found for date', async () => {
      // Set up test data - date
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      
      // Mock empty emails array
      getEmailsForSummary.mockResolvedValue([]);
      
      // Call the function
      const summary = await createDailySummary(date);
      
      // Verify that we got null as no emails were found
      expect(summary).toBeNull();
      
      // Verify that the summary generation functions were not called
      expect(generateSummary).not.toHaveBeenCalled();
      expect(categorizeEmails).not.toHaveBeenCalled();
    });
  });
  
  describe('distributeSummary', () => {
    test('should distribute a summary via email', async () => {
      // Create a summary for distribution
      const summary = new Summary({
        date: new Date(),
        content: 'Summary content for distribution',
        emailCount: 5,
        emailIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        topicCategories: [
          { name: 'Work', description: 'Work Emails' },
          { name: 'Personal', description: 'Personal Emails' }
        ]
      });
      
      await summary.save();
      
      // Mock sendEmail function
      sendEmail.mockResolvedValue({ messageId: 'test-message-id' });
      
      // Store original recipient email
      const originalRecipient = process.env.SUMMARY_RECIPIENT_EMAIL;
      process.env.SUMMARY_RECIPIENT_EMAIL = 'test@example.com';
      
      // Call the function
      const distributedSummary = await distributeSummary(summary._id);
      
      // Restore original recipient
      process.env.SUMMARY_RECIPIENT_EMAIL = originalRecipient;
      
      // Verify the email was sent
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: expect.stringContaining('Email Summary for'),
        html: expect.stringContaining(summary.content.replace(/\n/g, '<br>'))
      });
      
      // Verify the summary was marked as distributed
      expect(distributedSummary.isDistributed).toBe(true);
      expect(distributedSummary.distributedAt).toBeDefined();
      expect(distributedSummary.distributionRecipients).toContain('test@example.com');
    });
    
    test('should not redistribute already distributed summary', async () => {
      // Create an already distributed summary
      const summary = new Summary({
        date: new Date(),
        content: 'Previously distributed summary',
        emailCount: 2,
        emailIds: [new mongoose.Types.ObjectId()],
        isDistributed: true,
        distributedAt: new Date(),
        distributionRecipients: ['previous@example.com']
      });
      
      await summary.save();
      
      // Call the function
      const result = await distributeSummary(summary._id);
      
      // Verify no email was sent
      expect(sendEmail).not.toHaveBeenCalled();
      
      // Verify the summary remains unchanged
      expect(result.isDistributed).toBe(true);
      expect(result.distributionRecipients).toEqual(['previous@example.com']);
    });
    
    test('should throw error if summary not found', async () => {
      // Generate a non-existent ID
      const nonExistentId = new mongoose.Types.ObjectId();
      
      // Call the function and expect it to throw
      await expect(distributeSummary(nonExistentId)).rejects.toThrow(/not found/);
      
      // Verify no email was sent
      expect(sendEmail).not.toHaveBeenCalled();
    });
    
    test('should throw error if recipient email not configured', async () => {
      // Create a summary
      const summary = new Summary({
        date: new Date(),
        content: 'Summary without recipient',
        emailCount: 1,
        emailIds: [new mongoose.Types.ObjectId()]
      });
      
      await summary.save();
      
      // Store original recipient and set to undefined
      const originalRecipient = process.env.SUMMARY_RECIPIENT_EMAIL;
      delete process.env.SUMMARY_RECIPIENT_EMAIL;
      
      // Call the function and expect it to throw
      await expect(distributeSummary(summary._id)).rejects.toThrow(/Recipient email not configured/);
      
      // Restore original recipient
      process.env.SUMMARY_RECIPIENT_EMAIL = originalRecipient;
      
      // Verify no email was sent
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
}); 