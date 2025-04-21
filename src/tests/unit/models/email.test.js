const mongoose = require('mongoose');
const Email = require('../../../models/email');

describe('Email Model', () => {
  // Test for email creation with valid data
  test('should create a new email with valid data', async () => {
    const emailData = {
      messageId: 'test-message-id-123',
      threadId: 'test-thread-id-123',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email Subject',
      body: 'This is the email body content.',
      receivedAt: new Date()
    };

    const newEmail = new Email(emailData);
    const savedEmail = await newEmail.save();

    // Verify the saved email
    expect(savedEmail._id).toBeDefined();
    expect(savedEmail.messageId).toBe(emailData.messageId);
    expect(savedEmail.threadId).toBe(emailData.threadId);
    expect(savedEmail.from).toBe(emailData.from);
    expect(savedEmail.to).toBe(emailData.to);
    expect(savedEmail.subject).toBe(emailData.subject);
    expect(savedEmail.body).toBe(emailData.body);
    expect(savedEmail.receivedAt).toEqual(emailData.receivedAt);
    expect(savedEmail.isProcessed).toBe(false);
    expect(savedEmail.isSummarized).toBe(false);
  });

  // Test for required fields validation
  test('should not create an email without required fields', async () => {
    const emailWithoutRequired = new Email({
      // Missing required fields
      subject: 'Missing Required Fields',
      body: 'This email is missing required fields'
    });

    let validationError;
    try {
      await emailWithoutRequired.save();
    } catch (error) {
      validationError = error;
    }

    // Verify validation error
    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.messageId).toBeDefined();
    expect(validationError.errors.threadId).toBeDefined();
    expect(validationError.errors.from).toBeDefined();
    expect(validationError.errors.to).toBeDefined();
    expect(validationError.errors.receivedAt).toBeDefined();
  });

  // Test for uniqueness of messageId
  test('should not create emails with duplicate messageId', async () => {
    // First email
    const emailData1 = {
      messageId: 'duplicate-message-id',
      threadId: 'thread-id-1',
      from: 'sender1@example.com',
      to: 'recipient1@example.com',
      subject: 'First Email',
      body: 'First email body',
      receivedAt: new Date()
    };

    // Second email with same messageId
    const emailData2 = {
      messageId: 'duplicate-message-id', // Same messageId
      threadId: 'thread-id-2',
      from: 'sender2@example.com',
      to: 'recipient2@example.com',
      subject: 'Second Email',
      body: 'Second email body',
      receivedAt: new Date()
    };

    // Save first email
    const firstEmail = new Email(emailData1);
    await firstEmail.save();

    // Try to save second email
    const secondEmail = new Email(emailData2);
    let duplicateError;
    
    try {
      await secondEmail.save();
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
    const emailData = {
      messageId: 'default-values-test',
      threadId: 'thread-id-defaults',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Default Values',
      body: 'Testing default values',
      receivedAt: new Date()
    };

    const newEmail = new Email(emailData);
    const savedEmail = await newEmail.save();

    // Verify default values
    expect(savedEmail.isProcessed).toBe(false);
    expect(savedEmail.isSummarized).toBe(false);
    expect(savedEmail.labels).toEqual([]);
    expect(savedEmail.attachments).toEqual([]);
  });
}); 