const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { logger } = require('./utils/logger');
const routes = require('./routes');
const { startEmailSummaryJob } = require('./services/summaryService');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Schedule email summary job
if (process.env.SUMMARY_SCHEDULE) {
  cron.schedule(process.env.SUMMARY_SCHEDULE, async () => {
    logger.info('Running scheduled email summary job');
    try {
      await startEmailSummaryJob();
    } catch (error) {
      logger.error('Error in email summary job:', error);
    }
  });
}

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

module.exports = app; 