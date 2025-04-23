#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { fetchEmails } = require('../services/emailService');
const { createNewsletterQuery } = require('../config/newsletters');
const Email = require('../models/email');
const { logger } = require('../utils/logger');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

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
const daysBack = args.daysBack ? parseInt(args.daysBack, 10) : 1;

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

// Main function
async function main() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Create newsletter query
    const newsletterQuery = createNewsletterQuery();
    console.log('Newsletter query:', newsletterQuery);
    
    // Create date query
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const dateQuery = `after:${formattedDate}`;
    
    // Combine queries
    const finalQuery = `${newsletterQuery} ${dateQuery}`;
    
    console.log(`Fetching newsletter emails from Gmail...`);
    console.log(`Using query: "${finalQuery}"`);
    console.log(`Max results: ${maxResults}`);
    console.log(`Looking back ${daysBack} days`);
    
    // Get initial count for comparison
    const initialCount = await Email.countDocuments();
    console.log('Initial email count:', initialCount);
    
    // Fetch emails
    const options = {
      maxResults,
      query: finalQuery
    };
    
    console.log('Calling fetchEmails with options:', JSON.stringify(options));
    const fetchedEmails = await fetchEmails(options);
    
    // Get final count
    const finalCount = await Email.countDocuments();
    const newEmailCount = finalCount - initialCount;
    
    console.log(`\nFetch completed.`);
    console.log(`- Total newsletter emails found: ${fetchedEmails.length}`);
    console.log(`- New emails added to database: ${newEmailCount}`);
    
    // List the newsletters found
    if (fetchedEmails.length > 0) {
      console.log('\nNewsletters fetched:');
      
      // Group by sender
      const senderCounts = {};
      fetchedEmails.forEach(email => {
        const sender = email.from.match(/<([^>]+)>/) ? 
          email.from.match(/<([^>]+)>/)[1] : 
          email.from.split(' ')[0];
        
        senderCounts[sender] = (senderCounts[sender] || 0) + 1;
      });
      
      // Display list of senders and counts
      Object.entries(senderCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([sender, count]) => {
          console.log(`- ${sender}: ${count} emails`);
        });
    } else {
      console.log('No newsletter emails found matching the criteria.');
    }
    
  } catch (error) {
    logger.error('Error fetching newsletter emails:', error);
    console.error('Failed to fetch newsletter emails:', error.message);
    console.error(error);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the script
main();