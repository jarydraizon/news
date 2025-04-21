const express = require('express');
const { fetchEmails } = require('../services/emailService');
const Email = require('../models/email');
const { logger } = require('../utils/logger');

const router = express.Router();

// Route to fetch new emails
router.post('/fetch', async (req, res) => {
  try {
    const options = {
      maxResults: req.body.maxResults || 100,
      query: req.body.query || ''
    };
    
    const emails = await fetchEmails(options);
    
    res.json({
      status: 'success',
      message: `Fetched ${emails.length} new emails`,
      count: emails.length
    });
  } catch (error) {
    logger.error('Error fetching emails:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch emails',
      error: error.message
    });
  }
});

// Route to get email statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total emails
    const totalEmails = await Email.countDocuments();
    
    // Get emails by date range
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    startDate.setDate(startDate.getDate() - 30); // Default to last 30 days
    
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    
    const emailsInRange = await Email.countDocuments({
      receivedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get top senders
    const topSenders = await Email.aggregate([
      { $match: { receivedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$from', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      status: 'success',
      data: {
        totalEmails,
        emailsInRange,
        dateRange: {
          start: startDate,
          end: endDate
        },
        topSenders
      }
    });
  } catch (error) {
    logger.error('Error getting email statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get email statistics',
      error: error.message
    });
  }
});

// Route to list emails with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Build filter query
    const filter = {};
    
    if (req.query.startDate || req.query.endDate) {
      filter.receivedAt = {};
      if (req.query.startDate) {
        filter.receivedAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.receivedAt.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.from) {
      filter.from = { $regex: req.query.from, $options: 'i' };
    }
    
    if (req.query.subject) {
      filter.subject = { $regex: req.query.subject, $options: 'i' };
    }
    
    // Execute query with pagination
    const emails = await Email.find(filter)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('messageId threadId from subject snippet receivedAt labels');
    
    // Get total count for pagination
    const total = await Email.countDocuments(filter);
    
    res.json({
      status: 'success',
      data: {
        emails,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error listing emails:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list emails',
      error: error.message
    });
  }
});

// Route to get a single email by ID
router.get('/:id', async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    
    if (!email) {
      return res.status(404).json({
        status: 'error',
        message: 'Email not found'
      });
    }
    
    res.json({
      status: 'success',
      data: email
    });
  } catch (error) {
    logger.error(`Error getting email with ID ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get email',
      error: error.message
    });
  }
});

module.exports = router; 