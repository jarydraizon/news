const mongoose = require('mongoose');
const Summary = require('../../../models/summary');
const Email = require('../../../models/email');

describe('Summary Model', () => {
  // Test for summary creation with valid data
  test('should create a new summary with valid data', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create test email to reference
    const testEmail = new Email({
      messageId: 'test-message-id-for-summary',
      threadId: 'test-thread-id-for-summary',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email for Summary',
      body: 'Email content for summary test',
      receivedAt: today
    });
    
    const savedEmail = await testEmail.save();
    
    const summaryData = {
      date: today,
      content: 'This is a test summary content with key topics and information.',
      emailCount: 1,
      emailIds: [savedEmail._id],
      topicCategories: [
        { name: 'Test', description: 'Test Category' },
        { name: 'Summary', description: 'Summary Category' }
      ]
    };

    const newSummary = new Summary(summaryData);
    const savedSummary = await newSummary.save();

    // Verify the saved summary
    expect(savedSummary._id).toBeDefined();
    expect(savedSummary.date.toISOString()).toBe(today.toISOString());
    expect(savedSummary.content).toBe(summaryData.content);
    expect(savedSummary.emailCount).toBe(summaryData.emailCount);
    expect(savedSummary.emailIds.length).toBe(1);
    expect(savedSummary.emailIds[0].toString()).toBe(savedEmail._id.toString());
    expect(savedSummary.topicCategories.length).toBe(2);
    expect(savedSummary.isDistributed).toBe(false);
    expect(savedSummary.distributedAt).toBeUndefined();
    expect(savedSummary.distributionRecipients).toEqual([]);
  });

  // Test for required fields validation
  test('should not create a summary without required fields', async () => {
    const summaryWithoutRequired = new Summary({
      // Missing date, content, and emailCount
      topicCategories: [{ name: 'Test', description: 'Test Category' }]
    });

    let validationError;
    try {
      await summaryWithoutRequired.save();
    } catch (error) {
      validationError = error;
    }

    // Verify validation error
    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.date).toBeDefined();
    expect(validationError.errors.content).toBeDefined();
    expect(validationError.errors.emailCount).toBeDefined();
  });

  // Test for unique date constraint
  test('should not create summaries with the same date', async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0); // Set to start of day

    // First summary
    const summaryData1 = {
      date,
      content: 'First summary content',
      emailCount: 5,
      emailIds: []
    };

    // Second summary with same date
    const summaryData2 = {
      date, // Same date
      content: 'Second summary content',
      emailCount: 3,
      emailIds: []
    };

    // Save first summary
    const firstSummary = new Summary(summaryData1);
    await firstSummary.save();

    // Try to save second summary
    const secondSummary = new Summary(summaryData2);
    let duplicateError;
    
    try {
      await secondSummary.save();
    } catch (error) {
      duplicateError = error;
    }

    // Check for duplicate key error
    expect(duplicateError).toBeDefined();
    expect(duplicateError.name).toBe('MongoServerError');
    expect(duplicateError.code).toBe(11000); // MongoDB duplicate key error code
  });

  // Test for default values
  test('should set default values correctly', async () => {
    const summaryData = {
      date: new Date(),
      content: 'Summary with default values',
      emailCount: 10,
      emailIds: []
    };

    const newSummary = new Summary(summaryData);
    const savedSummary = await newSummary.save();

    // Verify default values
    expect(savedSummary.isDistributed).toBe(false);
    expect(savedSummary.distributedAt).toBeUndefined();
    expect(savedSummary.distributionRecipients).toEqual([]);
    expect(savedSummary.topicCategories).toEqual([]);
  });

  // Test for references to Email model
  test('should reference emails correctly', async () => {
    // Create multiple emails
    const emails = [];
    for (let i = 0; i < 3; i++) {
      const email = new Email({
        messageId: `ref-email-${i}`,
        threadId: `ref-thread-${i}`,
        from: `sender${i}@example.com`,
        to: `recipient${i}@example.com`,
        subject: `Reference Email ${i}`,
        body: `Email content ${i}`,
        receivedAt: new Date()
      });
      
      const savedEmail = await email.save();
      emails.push(savedEmail);
    }
    
    // Create summary referencing these emails
    const summaryData = {
      date: new Date(),
      content: 'Summary referencing multiple emails',
      emailCount: emails.length,
      emailIds: emails.map(email => email._id)
    };
    
    const newSummary = new Summary(summaryData);
    const savedSummary = await newSummary.save();
    
    // Verify email references
    expect(savedSummary.emailIds.length).toBe(emails.length);
    for (let i = 0; i < emails.length; i++) {
      expect(savedSummary.emailIds[i].toString()).toBe(emails[i]._id.toString());
    }
    
    // Verify populated data in a query (using populate)
    const populatedSummary = await Summary.findById(savedSummary._id).populate('emailIds');
    expect(populatedSummary.emailIds.length).toBe(emails.length);
    expect(populatedSummary.emailIds[0].messageId).toBeDefined();
    expect(populatedSummary.emailIds[0].subject).toBeDefined();
  });
}); 