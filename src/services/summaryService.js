const { getEmailsForSummary, markEmailsAsSummarized } = require('./emailService');
const { generateSummary, categorizeEmails } = require('../config/openai');
const Summary = require('../models/summary');
const { logger } = require('../utils/logger');
const { sendEmail } = require('./notificationService');

// Prepare emails for summarization by organizing their content
const prepareEmailsForSummary = (emails) => {
  return emails.map(email => ({
    id: email._id,
    subject: email.subject,
    from: email.from,
    receivedAt: email.receivedAt,
    content: email.body,
    snippet: email.snippet
  }));
};

// Process emails in batches
const processBatches = async (emails, batchSize) => {
  const batches = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }

  let allSummaries = [];
  for (const batch of batches) {
    try {
      // For each batch, we concatenate simplified email content
      const batchContent = batch.map(email => 
        `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.receivedAt.toISOString()}\n\n${email.content}\n\n---\n\n`
      ).join('');
      
      // Generate summary for the batch
      const batchSummary = await generateSummary(batchContent);
      allSummaries.push({
        emails: batch,
        summary: batchSummary
      });
    } catch (error) {
      logger.error('Error processing batch for summary:', error);
      // Continue with the next batch
    }
  }
  
  return allSummaries;
};

// Generate a combined summary from batch summaries
const generateCombinedSummary = async (batchSummaries, allEmails) => {
  try {
    // Combine all batch summaries
    const combinedContent = batchSummaries
      .map(batch => batch.summary)
      .join('\n\n===BATCH SEPARATOR===\n\n');
    
    // Generate categories for organizing emails
    let topicCategories = [];
    try {
      const categorization = await categorizeEmails(allEmails);
      // Parse the categorization result and format as categories
      // This is a simplified approach - in a real implementation we would parse the 
      // structured output from the LLM
      topicCategories = categorization.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          const name = line.includes(':') ? line.split(':')[0].trim() : line.trim();
          return { name, description: line.trim() };
        });
    } catch (error) {
      logger.error('Error categorizing emails:', error);
      // Proceed without categories if there's an error
    }

    // Generate the final summary of summaries
    const finalSummaryContent = await generateSummary(
      `Please create a consolidated daily email summary from the following batch summaries:\n\n${combinedContent}`
    );

    return {
      content: finalSummaryContent,
      topicCategories
    };
  } catch (error) {
    logger.error('Error generating combined summary:', error);
    throw error;
  }
};

// Create a daily summary
const createDailySummary = async (date = new Date()) => {
  try {
    // Set the date range for the summary (from start to end of the specified day)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    // Check if a summary already exists for this date
    const existingSummary = await Summary.findOne({ date: startDate });
    if (existingSummary) {
      logger.info(`Summary already exists for ${startDate.toDateString()}`);
      return existingSummary;
    }

    // Get all unsummarized emails for the date range
    const emails = await getEmailsForSummary(startDate, endDate);
    if (emails.length === 0) {
      logger.info(`No emails to summarize for ${startDate.toDateString()}`);
      return null;
    }

    logger.info(`Generating summary for ${emails.length} emails from ${startDate.toDateString()}`);
    
    // Prepare emails for processing
    const preparedEmails = prepareEmailsForSummary(emails);
    
    // Process emails in batches
    const batchSize = parseInt(process.env.EMAILS_BATCH_SIZE) || 50;
    const batchSummaries = await processBatches(preparedEmails, batchSize);
    
    // Generate combined summary
    const { content, topicCategories } = await generateCombinedSummary(batchSummaries, preparedEmails);
    
    // Create summary document
    const summary = new Summary({
      date: startDate,
      content,
      topicCategories,
      emailCount: emails.length,
      emailIds: emails.map(email => email._id)
    });
    
    await summary.save();
    
    // Mark all processed emails as summarized
    await markEmailsAsSummarized(emails.map(email => email._id));
    
    logger.info(`Daily summary created for ${startDate.toDateString()} with ${emails.length} emails`);
    
    return summary;
  } catch (error) {
    logger.error('Error creating daily summary:', error);
    throw error;
  }
};

// Distribute the summary via email
const distributeSummary = async (summaryId) => {
  try {
    const summary = await Summary.findById(summaryId);
    if (!summary) {
      throw new Error(`Summary with ID ${summaryId} not found`);
    }
    
    if (summary.isDistributed) {
      logger.info(`Summary ID ${summaryId} already distributed on ${summary.distributedAt}`);
      return summary;
    }
    
    const recipientEmail = process.env.SUMMARY_RECIPIENT_EMAIL;
    if (!recipientEmail) {
      throw new Error('Recipient email not configured');
    }
    
    // Format the email body with categories
    let emailBody = `<h1>Daily Email Summary - ${summary.date.toDateString()}</h1>`;
    emailBody += `<p><strong>Total Emails Processed:</strong> ${summary.emailCount}</p>`;
    
    if (summary.topicCategories && summary.topicCategories.length > 0) {
      emailBody += '<h2>Topics Overview</h2><ul>';
      summary.topicCategories.forEach(category => {
        emailBody += `<li>${category.description}</li>`;
      });
      emailBody += '</ul>';
    }
    
    emailBody += '<h2>Summary</h2>';
    emailBody += `<div>${summary.content.replace(/\n/g, '<br>')}</div>`;
    
    // Send the email notification
    await sendEmail({
      to: recipientEmail,
      subject: `Email Summary for ${summary.date.toDateString()}`,
      html: emailBody
    });
    
    // Update the summary as distributed
    summary.isDistributed = true;
    summary.distributedAt = new Date();
    summary.distributionRecipients = [recipientEmail];
    await summary.save();
    
    logger.info(`Summary ID ${summaryId} distributed to ${recipientEmail}`);
    
    return summary;
  } catch (error) {
    logger.error(`Error distributing summary ID ${summaryId}:`, error);
    throw error;
  }
};

// Main function to run the email summary job
const startEmailSummaryJob = async () => {
  try {
    logger.info('Starting email summary job');
    
    // Fetch new emails first
    const { fetchEmails } = require('./emailService');
    await fetchEmails();
    
    // Create daily summary for yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const summary = await createDailySummary(yesterday);
    if (summary) {
      await distributeSummary(summary._id);
    }
    
    logger.info('Email summary job completed successfully');
  } catch (error) {
    logger.error('Error in email summary job:', error);
    throw error;
  }
};

module.exports = {
  createDailySummary,
  distributeSummary,
  startEmailSummaryJob
}; 