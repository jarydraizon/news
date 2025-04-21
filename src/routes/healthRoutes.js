const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../config/logger');
const packageInfo = require('../../package.json');

/**
 * @route GET /api/health
 * @desc Check server health
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // Check MongoDB connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Create response object
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: packageInfo.version,
      service: packageInfo.name,
      database: {
        status: dbStatus
      },
      uptime: Math.floor(process.uptime())
    };
    
    // Log health check
    logger.info('Health check performed', { healthData });
    
    return res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * @route GET /api/health/deep
 * @desc Perform a deep health check including database
 * @access Public
 */
router.get('/deep', async (req, res) => {
  try {
    // Check MongoDB connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Verify database connection by running a simple command
    let dbPingStatus = 'failed';
    try {
      if (dbStatus === 'connected') {
        await mongoose.connection.db.admin().ping();
        dbPingStatus = 'success';
      }
    } catch (dbError) {
      logger.error('Database ping failed', { error: dbError.message });
      dbPingStatus = 'error: ' + dbError.message;
    }
    
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    
    // Create response object
    const healthData = {
      status: dbStatus === 'connected' && dbPingStatus === 'success' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: packageInfo.version,
      service: packageInfo.name,
      database: {
        status: dbStatus,
        ping: dbPingStatus
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
        },
        nodeVersion: process.version
      }
    };
    
    // Log health check
    logger.info('Deep health check performed', { healthData });
    
    return res.status(healthData.status === 'ok' ? 200 : 503).json(healthData);
  } catch (error) {
    logger.error('Deep health check failed', { error: error.message });
    return res.status(500).json({ 
      status: 'error',
      message: 'Deep health check failed',
      error: error.message
    });
  }
});

module.exports = router; 