const express = require('express');
const { createDailySummary, distributeSummary, startEmailSummaryJob } = require('../services/summaryService');
const Summary = require('../models/summary');
const { logger } = require('../utils/logger');

const router = express.Router();

// Route to list summaries with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filter = {};
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.date.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.distributed !== undefined) {
      filter.isDistributed = req.query.distributed === 'true';
    }
    
    // Execute query with pagination
    const summaries = await Summary.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select('date emailCount topicCategories isDistributed distributedAt');
    
    // Get total count for pagination
    const total = await Summary.countDocuments(filter);
    
    res.json({
      status: 'success',
      data: {
        summaries,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error listing summaries:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list summaries',
      error: error.message
    });
  }
});

// Route to get a single summary by ID
router.get('/:id', async (req, res) => {
  try {
    const summary = await Summary.findById(req.params.id);
    
    if (!summary) {
      return res.status(404).json({
        status: 'error',
        message: 'Summary not found'
      });
    }
    
    res.json({
      status: 'success',
      data: summary
    });
  } catch (error) {
    logger.error(`Error getting summary with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get summary',
      error: error.message
    });
  }
});

// Route to manually generate a summary for a specific date
router.post('/generate', async (req, res) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date();
    
    // Start summary generation
    const summary = await createDailySummary(date);
    
    if (!summary) {
      return res.status(404).json({
        status: 'error',
        message: 'No emails found for the specified date or summary already exists'
      });
    }
    
    res.json({
      status: 'success',
      message: `Summary generated for ${date.toDateString()}`,
      data: {
        summaryId: summary._id,
        date: summary.date,
        emailCount: summary.emailCount
      }
    });
  } catch (error) {
    logger.error('Error generating summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate summary',
      error: error.message
    });
  }
});

// Route to manually distribute a summary
router.post('/:id/distribute', async (req, res) => {
  try {
    const summary = await distributeSummary(req.params.id);
    
    res.json({
      status: 'success',
      message: `Summary distributed successfully`,
      data: {
        summaryId: summary._id,
        date: summary.date,
        distributedAt: summary.distributedAt,
        recipients: summary.distributionRecipients
      }
    });
  } catch (error) {
    logger.error(`Error distributing summary with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to distribute summary',
      error: error.message
    });
  }
});

// Route to manually run the email summary job
router.post('/job/run', async (req, res) => {
  try {
    // Start job asynchronously
    res.json({
      status: 'success',
      message: 'Email summary job started'
    });
    
    // Run the job after sending response
    await startEmailSummaryJob();
  } catch (error) {
    logger.error('Error starting email summary job:', error);
    // Error is logged but not returned since response is already sent
  }
});

module.exports = router; 