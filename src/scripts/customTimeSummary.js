#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { logger } = require('../utils/logger');
const Email = require('../models/email');
const Summary = require('../models/summary');
const { generateSummary, categorizeEmails } = require('../config/openai');
const { sendEmail } = require('../services/notificationService');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Get emails within the custom time window (7:15am to 6:45am next day)
async function getEmailsForCustomTimeWindow() {
  // Calculate the time window
  const now = new Date();
  
  // Starting point: Today at 7:15am
  const startDate = new Date(now);
  startDate.setHours(7, 15, 0, 0);
  
  // If current time is before 7:15am, use yesterday's 7:15am
  if (now.getHours() < 7 || (now.getHours() === 7 && now.getMinutes() < 15)) {
    startDate.setDate(startDate.getDate() - 1);
  }
  
  // Ending point: Next day at 6:45am
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setHours(6, 45, 0, 0);
  
  // If we're past the end time, adjust start and end to the next period
  if (now > endDate) {
    startDate.setDate(startDate.getDate() + 1);
    endDate.setDate(endDate.getDate() + 1);
  }
  
  console.log(`Fetching emails from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
  
  try {
    // Get all emails within the time window, regardless of their summarization status
    return await Email.find({
      receivedAt: { $gte: startDate, $lte: endDate }
    }).sort({ receivedAt: 1 });
  } catch (error) {
    logger.error('Error fetching emails for custom time window:', error);
    throw error;
  }
}

// Process emails in batches for summarization
async function processEmailBatches(emails, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }

  console.log(`Processing ${emails.length} emails in ${batches.length} batches`);
  
  let allSummaries = [];
  for (const [index, batch] of batches.entries()) {
    try {
      console.log(`Processing batch ${index + 1}/${batches.length} with ${batch.length} emails`);
      
      // For each batch, concatenate email content
      const batchContent = batch.map(email => 
        `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.receivedAt.toISOString()}\n\n${email.body || email.snippet}\n\n---\n\n`
      ).join('');
      
      // Generate summary for the batch
      const batchSummary = await generateSummary(batchContent);
      allSummaries.push({
        emails: batch,
        summary: batchSummary
      });
    } catch (error) {
      logger.error(`Error processing batch ${index + 1}:`, error);
      // Continue with the next batch
    }
  }
  
  return allSummaries;
}

// Create a combined summary from all batches
async function createCombinedSummary(batchSummaries, allEmails) {
  try {
    // Combine all batch summaries
    const combinedContent = batchSummaries
      .map(batch => batch.summary)
      .join('\n\n===BATCH SEPARATOR===\n\n');
    
    // Generate categories for organizing emails
    let topicCategories = [];
    try {
      const emailsForCategories = allEmails.map(email => ({
        subject: email.subject,
        from: email.from
      }));
      
      const categorization = await categorizeEmails(emailsForCategories);
      
      // Parse the categorization result into categories
      topicCategories = categorization.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          const name = line.includes(':') ? line.split(':')[0].trim() : line.trim();
          return { name, description: line.trim() };
        });
        
      console.log(`Generated ${topicCategories.length} topic categories`);
    } catch (error) {
      logger.error('Error categorizing emails:', error);
      // Proceed without categories if there's an error
    }

    // Generate the final summary
    const finalPrompt = `
    Please create a comprehensive summary of the following email content:
    
    ${combinedContent}
    
    Focus on:
    1. Key news and information
    2. Important announcements
    3. Market trends and business insights
    4. Technology updates
    5. Organize by topic areas
    
    This summary will be sent as a newsletter, so make it engaging and informative.
    `;
    
    const finalSummaryContent = await generateSummary(finalPrompt, { maxTokens: 2000 });

    return {
      content: finalSummaryContent,
      topicCategories
    };
  } catch (error) {
    logger.error('Error generating combined summary:', error);
    throw error;
  }
}

// Send the summary via email
async function sendSummaryEmail(content, topicCategories, emailCount) {
  try {
    const recipientEmail = process.env.SUMMARY_RECIPIENT_EMAIL;
    if (!recipientEmail) {
      throw new Error('Recipient email not configured');
    }
    
    const now = new Date();
    
    // Format the email body with categories
    let emailBody = `<h1>Morning Email Summary - ${now.toDateString()}</h1>`;
    emailBody += `<p><strong>Total Emails Processed:</strong> ${emailCount}</p>`;
    
    if (topicCategories && topicCategories.length > 0) {
      emailBody += '<h2>Topics Overview</h2><ul>';
      topicCategories.forEach(category => {
        emailBody += `<li>${category.description}</li>`;
      });
      emailBody += '</ul>';
    }
    
    emailBody += '<h2>Summary</h2>';
    emailBody += `<div>${content.replace(/\n/g, '<br>')}</div>`;
    
    // Send the email notification
    await sendEmail({
      to: recipientEmail,
      subject: `Morning Email Summary for ${now.toDateString()}`,
      html: emailBody
    });
    
    console.log(`Summary email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error('Error sending summary email:', error);
    throw error;
  }
}

// Save summary to database
async function saveSummaryToDatabase(content, topicCategories, emails) {
  try {
    const now = new Date();
    
    // Create summary document
    const summary = new Summary({
      date: now,
      content,
      topicCategories,
      emailCount: emails.length,
      emailIds: emails.map(email => email._id),
      metadata: {
        customTimeWindow: true,
        startTime: "7:15 AM",
        endTime: "6:45 AM"
      }
    });
    
    await summary.save();
    
    // Mark all processed emails as summarized
    const emailIds = emails.map(email => email._id);
    await Email.updateMany(
      { _id: { $in: emailIds } },
      { $set: { isSummarized: true } }
    );
    
    console.log(`Custom time window summary saved to database with ID: ${summary._id}`);
    return summary;
  } catch (error) {
    logger.error('Error saving summary to database:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    await connectToDatabase();
    
    // Get emails for the custom time window
    const emails = await getEmailsForCustomTimeWindow();
    
    if (emails.length === 0) {
      console.log('No emails found in the specified time window.');
      return;
    }
    
    console.log(`Found ${emails.length} emails in the specified time window.`);
    
    // Process emails in batches
    const batchSize = parseInt(process.env.EMAILS_BATCH_SIZE) || 10;
    const batchSummaries = await processEmailBatches(emails, batchSize);
    
    if (batchSummaries.length === 0) {
      console.log('Failed to generate any batch summaries.');
      return;
    }
    
    // Generate the combined summary
    const { content, topicCategories } = await createCombinedSummary(batchSummaries, emails);
    
    // Save the summary to the database
    const savedSummary = await saveSummaryToDatabase(content, topicCategories, emails);
    
    // Send the summary via email
    await sendSummaryEmail(content, topicCategories, emails.length);
    
    console.log('Custom time window summary process completed successfully.');
    
  } catch (error) {
    logger.error('Error in custom time window summary process:', error);
    console.error('An error occurred:', error.message);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the script
main();