#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { startEmailSummaryJob } = require('../services/summaryService');
const { logger } = require('../utils/logger');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Main function to run the job
async function runJob() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for scheduled job.');

    // Run the summary job
    await startEmailSummaryJob();

    logger.info('Scheduled job finished successfully.');
  } catch (error) {
    logger.error('Error running scheduled job:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runJob();