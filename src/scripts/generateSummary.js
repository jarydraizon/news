#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { createDailySummary, distributeSummary } = require('../services/summaryService');
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

// Default to yesterday if no date provided
let targetDate;
if (args.date) {
  targetDate = new Date(args.date);
  if (isNaN(targetDate.getTime())) {
    console.error(`Invalid date format: ${args.date}. Please use YYYY-MM-DD.`);
    process.exit(1);
  }
} else {
  targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1); // Yesterday
}

// Flag to determine if summary should be distributed
const shouldDistribute = args.distribute === 'true';

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
    
    // Format target date for display
    const formattedDate = targetDate.toISOString().split('T')[0];
    console.log(`Generating summary for date: ${formattedDate}`);
    
    // Create the summary
    const summary = await createDailySummary(targetDate);
    
    if (!summary) {
      console.log(`No emails found for ${formattedDate} or summary already exists.`);
      return;
    }
    
    console.log('\nSummary generated successfully:');
    console.log(`- Date: ${summary.date.toDateString()}`);
    console.log(`- Email count: ${summary.emailCount}`);
    console.log(`- Topic categories: ${summary.topicCategories.length}`);
    console.log(`- Content length: ${summary.content.length} characters`);
    
    // Distribute summary if requested
    if (shouldDistribute) {
      console.log('\nDistributing summary via email...');
      const distributedSummary = await distributeSummary(summary._id);
      console.log(`Summary distributed to: ${distributedSummary.distributionRecipients.join(', ')}`);
    } else {
      console.log('\nTo distribute this summary, run with --distribute=true');
    }
    
  } catch (error) {
    logger.error('Error generating summary:', error);
    console.error('Failed to generate summary:', error.message);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
main(); 