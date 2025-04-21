#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { fetchEmails } = require('../services/emailService');
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
const query = args.query || '';
const daysBack = args.daysBack ? parseInt(args.daysBack, 10) : 0;

// Create a query based on date if specified
let dateQuery = '';
if (daysBack > 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  dateQuery = `after:${formattedDate}`;
  
  // Combine with the existing query if any
  if (query) {
    dateQuery = `${query} ${dateQuery}`;
  }
}

// Construct final query
const finalQuery = dateQuery || query;

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

// Main function
async function main() {
  try {
    // Connect to database
    await connectToDatabase();
    
    console.log(`Fetching emails from Gmail...`);
    if (finalQuery) {
      console.log(`Using query: "${finalQuery}"`);
    }
    console.log(`Max results: ${maxResults}`);
    
    // Get initial count for comparison
    const initialCount = await Email.countDocuments();
    
    // Fetch emails
    const options = {
      maxResults,
      query: finalQuery
    };
    
    const fetchedEmails = await fetchEmails(options);
    
    // Get final count
    const finalCount = await Email.countDocuments();
    const newEmailCount = finalCount - initialCount;
    
    console.log(`\nFetch completed.`);
    console.log(`- Total emails found in Gmail search: ${fetchedEmails.length}`);
    console.log(`- New emails added to database: ${newEmailCount}`);
    console.log(`- Total emails in database: ${finalCount}`);
    
  } catch (error) {
    logger.error('Error fetching emails:', error);
    console.error('Failed to fetch emails:', error.message);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the script
main(); 