const express = require('express');
const authRoutes = require('./authRoutes');
const emailRoutes = require('./emailRoutes');
const summaryRoutes = require('./summaryRoutes');

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/summaries', summaryRoutes);

// Root route
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Gmail Monitor and Summarizer API',
    version: '1.0.0'
  });
});

module.exports = router; 