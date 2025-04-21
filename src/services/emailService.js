const { getGmailService } = require('../config/gmail');
const Email = require('../models/email');
const { logger } = require('../utils/logger');
const cheerio = require('cheerio');

// Helper: Base64 URL decode
const base64UrlDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(str, 'base64').toString('utf-8');
};

// Extract plain text from HTML
const extractTextFromHtml = (html) => {
  try {
    const $ = cheerio.load(html);
    // Remove script and style elements
    $('script, style').remove();
    // Get the text
    return $.text().replace(/\s+/g, ' ').trim();
  } catch (error) {
    logger.error('Error extracting text from HTML:', error);
    return html; // Return the original HTML if extraction fails
  }
};

// Process email parts to extract body
const processEmailParts = (parts) => {
  let plainText = '';
  let htmlBody = '';

  const extractContent = (part) => {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      plainText += base64UrlDecode(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
      htmlBody += base64UrlDecode(part.body.data);
    } else if (part.parts) {
      part.parts.forEach(extractContent);
    }
  };

  if (parts) {
    parts.forEach(extractContent);
  }

  // If we have HTML but no plain text, extract text from HTML
  if (!plainText && htmlBody) {
    plainText = extractTextFromHtml(htmlBody);
  }

  return { plainText, htmlBody };
};

// Extract email data from Gmail message
const extractEmailData = (message) => {
  try {
    const { id, threadId, internalDate, payload, labelIds } = message;
    const headers = payload.headers.reduce((acc, header) => {
      acc[header.name.toLowerCase()] = header.value;
      return acc;
    }, {});

    // Process email content
    let { plainText, htmlBody } = processEmailParts(payload.parts);

    // If no parts found, check the body directly
    if (!plainText && payload.body && payload.body.data) {
      plainText = base64UrlDecode(payload.body.data);
      if (payload.mimeType === 'text/html') {
        htmlBody = plainText;
        plainText = extractTextFromHtml(htmlBody);
      }
    }

    // Extract attachment information
    const attachments = [];
    const processAttachments = (parts) => {
      if (!parts) return;
      
      parts.forEach(part => {
        if (part.filename && part.filename.length > 0) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId
          });
        }
        if (part.parts) {
          processAttachments(part.parts);
        }
      });
    };

    processAttachments(payload.parts);

    return {
      messageId: id,
      threadId,
      from: headers.from || '',
      to: headers.to || '',
      cc: headers.cc || '',
      bcc: headers.bcc || '',
      subject: headers.subject || '',
      snippet: message.snippet || '',
      body: plainText || '',
      htmlBody: htmlBody || '',
      receivedAt: new Date(parseInt(internalDate)),
      labels: labelIds || [],
      attachments
    };
  } catch (error) {
    logger.error(`Error extracting email data for message ID ${message.id}:`, error);
    throw error;
  }
};

// Fetch emails from Gmail
const fetchEmails = async (options = {}) => {
  const { maxResults = 100, query = '', startHistoryId = null } = options;
  
  try {
    const gmail = getGmailService();
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query,
      startHistoryId
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      logger.info('No new emails found');
      return [];
    }

    logger.info(`Found ${response.data.messages.length} emails to process`);
    
    const emails = [];
    // Process each message
    for (const message of response.data.messages) {
      try {
        // Check if email already exists in database
        const existingEmail = await Email.findOne({ messageId: message.id });
        if (existingEmail) {
          logger.debug(`Email with messageId ${message.id} already exists. Skipping.`);
          continue;
        }

        // Get full message details
        const messageDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        // Extract email data
        const emailData = extractEmailData(messageDetails.data);
        
        // Create new email document
        const newEmail = new Email(emailData);
        await newEmail.save();
        
        emails.push(newEmail);
        logger.debug(`Saved email with messageId ${message.id}`);
      } catch (error) {
        logger.error(`Error processing message ID ${message.id}:`, error);
        // Continue with next message
        continue;
      }
    }

    logger.info(`Successfully processed ${emails.length} emails`);
    return emails;
  } catch (error) {
    logger.error('Error fetching emails from Gmail:', error);
    throw error;
  }
};

// Get emails for summarization within a date range
const getEmailsForSummary = async (startDate, endDate) => {
  try {
    return await Email.find({
      receivedAt: { $gte: startDate, $lte: endDate },
      isSummarized: false
    }).sort({ receivedAt: 1 });
  } catch (error) {
    logger.error('Error fetching emails for summary:', error);
    throw error;
  }
};

// Mark emails as summarized
const markEmailsAsSummarized = async (emailIds) => {
  try {
    const result = await Email.updateMany(
      { _id: { $in: emailIds } },
      { $set: { isSummarized: true } }
    );
    logger.info(`Marked ${result.modifiedCount} emails as summarized`);
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error marking emails as summarized:', error);
    throw error;
  }
};

module.exports = {
  fetchEmails,
  getEmailsForSummary,
  markEmailsAsSummarized
}; 