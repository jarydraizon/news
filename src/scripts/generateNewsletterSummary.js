#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { fetchEmails } = require('../services/emailService');
const { createNewsletterQuery } = require('../config/newsletters');
const Email = require('../models/email');
const Summary = require('../models/summary');
const { sendEmail } = require('../services/notificationService');
const { logger } = require('../utils/logger');

// Load environment variables first
const envPath = path.join(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  console.log(`.env file exists at ${envPath}`);
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  console.log('Parsed environment variables:', Object.keys(envConfig));
  
  // Check for OpenAI API key in parsed config
  if (envConfig.OPENAI_API_KEY) {
    console.log(`OPENAI_API_KEY found in .env file: ${envConfig.OPENAI_API_KEY.substring(0, 7)}...`);
  } else {
    console.log('OPENAI_API_KEY not found in parsed .env file');
  }
  
  dotenv.config({ path: envPath });
} else {
  console.log(`.env file does not exist at ${envPath}`);
  dotenv.config();
}

// Log environment variables after loading
console.log('Environment variables after loading:');
console.log(`OPENAI_API_KEY present: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
if (process.env.OPENAI_API_KEY) {
  console.log(`OPENAI_API_KEY starts with: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);
}
console.log(`RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'Yes' : 'No'}`);
if (process.env.RESEND_API_KEY) {
  console.log(`RESEND_API_KEY starts with: ${process.env.RESEND_API_KEY.substring(0, 5)}...`);
}

// Now import OpenAI-related modules after environment is loaded and explicitly initialize
const { initOpenAI, generateSummary, categorizeEmails } = require('../config/openai');

// Initialize OpenAI with the API key
const { apiKeyValid } = initOpenAI(process.env.OPENAI_API_KEY);
console.log(`OpenAI initialization result: API key valid: ${apiKeyValid}`);

// Parse command line arguments
const argv = process.argv.slice(2);
const args = {};
argv.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key && value) {
    args[key.replace('--', '')] = value;
  }
});

// Set parameters from command-line arguments or defaults
const maxResults = args.maxResults ? parseInt(args.maxResults, 10) : 100;
const daysBack = args.daysBack ? parseInt(args.daysBack, 10) : 7; // Default to 7 days back
const recipientEmail = args.email || process.env.SUMMARY_RECIPIENT_EMAIL || 'jraizon@gmail.com';

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    console.log('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Fetch newsletters using newsletterQuery
async function fetchNewsletters() {
  try {
    console.log('Fetching newsletter emails...');
    
    // Create newsletter query
    const newsletterQuery = createNewsletterQuery();
    
    // Create date query
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const dateQuery = `after:${formattedDate}`;
    
    // Combine queries
    const finalQuery = `${newsletterQuery} ${dateQuery}`;
    
    console.log(`Using query: "${finalQuery}"`);
    console.log(`Max results: ${maxResults}`);
    console.log(`Looking back ${daysBack} days`);
    
    // Fetch emails
    const options = {
      maxResults,
      query: finalQuery
    };
    
    const fetchedEmails = await fetchEmails(options);
    console.log(`Fetched ${fetchedEmails.length} newsletter emails`);
    
    return fetchedEmails;
  } catch (error) {
    logger.error('Error fetching newsletter emails:', error);
    console.error('Error fetching newsletter emails:', error);
    throw error;
  }
}

// Get newsletter emails from database
async function getNewslettersFromDb() {
  try {
    console.log('Getting newsletter emails from database...');
    
    // Create date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    console.log(`Looking for emails between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    
    // Get newsletter addresses
    const { newsletterSources } = require('../config/newsletters');
    
    // Query the database for emails from newsletter sources
    const emails = await Email.find({
      receivedAt: { $gte: startDate, $lte: endDate },
      from: { $in: newsletterSources.map(source => new RegExp(source, 'i')) }
    }).sort({ receivedAt: -1 }).limit(maxResults);
    
    console.log(`Found ${emails.length} newsletter emails in database`);
    
    return emails;
  } catch (error) {
    logger.error('Error getting newsletters from database:', error);
    console.error('Error getting newsletters from database:', error);
    throw error;
  }
}

// Prepare emails for summarization
function prepareEmailsForSummary(emails) {
  return emails.map(email => ({
    id: email._id,
    subject: email.subject,
    from: email.from,
    receivedAt: email.receivedAt,
    content: email.body,
    snippet: email.snippet
  }));
}

// Generate summary for emails
async function generateNewsletterSummary(emails) {
  try {
    console.log('Generating summary for', emails.length, 'emails...');
    
    // Prepare emails for processing
    const preparedEmails = prepareEmailsForSummary(emails);
    
    // Categorize emails
    console.log('Categorizing emails...');
    const categorization = await categorizeEmails(preparedEmails);
    
    // Parse the categorization result
    const categories = categorization.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const name = line.includes(':') ? line.split(':')[0].trim() : line.trim();
        return { name, description: line.trim() };
      });
    
    console.log('Identified', categories.length, 'categories');
    
    // Break emails into smaller batches to avoid token limits
    const BATCH_SIZE = 3; // Process 3 emails at a time
    const batches = [];
    
    for (let i = 0; i < preparedEmails.length; i += BATCH_SIZE) {
      batches.push(preparedEmails.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing emails in ${batches.length} batches to avoid token limits`);
    
    // Process each batch and generate a summary
    let batchSummaries = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Generating summary for batch ${i+1}/${batches.length} (${batch.length} emails)`);
      
      // Combine batch content
      const batchContent = batch.map(email => 
        `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.receivedAt.toISOString()}\n\n${email.content.substring(0, 2000)}...\n\n---\n\n`
      ).join('');
      
      // Generate summary for this batch
      try {
        const batchSummary = await generateSummary(batchContent);
        batchSummaries.push(batchSummary);
        console.log(`Successfully generated summary for batch ${i+1}`);
      } catch (error) {
        console.error(`Error generating summary for batch ${i+1}:`, error.message);
        batchSummaries.push(`Error processing batch ${i+1}: ${error.message}`);
      }
    }
    
    // Combine batch summaries into a single summary
    console.log('Generating final summary from batch summaries...');
    const combinedSummaryContent = `Please create a consolidated summary from these individual batch summaries:\n\n${batchSummaries.join('\n\n=====BATCH SEPARATOR=====\n\n')}`;
    
    // Use a smaller model for the final summary to ensure we don't hit token limits
    const finalSummary = await generateSummary(combinedSummaryContent, { maxTokens: 800 });
    
    // Create summary document
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const summary = new Summary({
      date: new Date(),
      content: finalSummary,
      topicCategories: categories,
      emailCount: emails.length,
      emailIds: emails.map(email => email.id)
    });
    
    await summary.save();
    console.log('Summary saved to database');
    
    return summary;
  } catch (error) {
    logger.error('Error generating newsletter summary:', error);
    console.error('Error generating newsletter summary:', error);
    throw error;
  }
}

// Send summary email
async function sendSummaryEmail(summary) {
  try {
    console.log('Sending summary email to', recipientEmail);
    
    // Format email HTML
    let emailHtml = `<h1>Newsletter Summary - ${summary.date.toDateString()}</h1>`;
    emailHtml += `<p><strong>Newsletters Processed:</strong> ${summary.emailCount}</p>`;
    
    if (summary.topicCategories && summary.topicCategories.length > 0) {
      emailHtml += '<h2>Topics Overview</h2><ul>';
      summary.topicCategories.forEach(category => {
        emailHtml += `<li>${category.description}</li>`;
      });
      emailHtml += '</ul>';
    }
    
    emailHtml += '<h2>Summary</h2>';
    emailHtml += `<div>${summary.content.replace(/\n/g, '<br>')}</div>`;
    
    // Send email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Newsletter Summary - ${summary.date.toDateString()}`,
      html: emailHtml
    });
    
    // Update summary as distributed
    summary.isDistributed = true;
    summary.distributedAt = new Date();
    summary.distributionRecipients = [recipientEmail];
    await summary.save();
    
    console.log('Summary email sent successfully');
    console.log('Summary marked as distributed:', summary.isDistributed);
    return true;
  } catch (error) {
    logger.error('Error sending summary email:', error);
    console.error('Error sending summary email:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Fetch new newsletters
    const newNewsletters = await fetchNewsletters();
    
    // If no new newsletters, get existing newsletters from the database
    let newsletters = newNewsletters;
    if (newsletters.length === 0) {
      console.log('No new newsletter emails found. Looking for existing emails in database...');
      newsletters = await getNewslettersFromDb();
    }
    
    if (newsletters.length === 0) {
      console.log('No newsletter emails found at all. Exiting.');
      await mongoose.disconnect();
      return;
    }
    
    // Generate summary
    const summary = await generateNewsletterSummary(newsletters);
    
    // Send summary email
    await sendSummaryEmail(summary);
    
    console.log('Newsletter summary process completed successfully');
  } catch (error) {
    console.error('Error in newsletter summary process:', error);
    logger.error('Error in newsletter summary process:', error);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the script
main(); 