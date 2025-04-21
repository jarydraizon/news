const express = require('express');
const { getAuthUrl, createOAuth2Client } = require('../config/gmail');
const { logger } = require('../utils/logger');
const { google } = require('googleapis');

const router = express.Router();

// Route to initiate Google OAuth2 flow
router.get('/google', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error initiating Google OAuth flow:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate Google authentication'
    });
  }
});

// Route to handle OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({
      status: 'error',
      message: 'Authorization code is required'
    });
  }
  
  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Log tokens for configuration (in a real app, store securely)
    logger.info('Authentication successful! Configure your .env file with these tokens:');
    logger.info(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    
    res.json({
      status: 'success',
      message: 'Authentication successful! Check server logs for refresh token.',
      // Don't include access token in response in production
      ...(process.env.NODE_ENV !== 'production' && { refreshToken: tokens.refresh_token })
    });
  } catch (error) {
    logger.error('Error handling Google OAuth callback:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete Google authentication'
    });
  }
});

// Route to verify authentication status
router.get('/status', async (req, res) => {
  try {
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      return res.json({
        status: 'unauthenticated',
        message: 'Application is not authenticated with Gmail'
      });
    }

    // Try to create a client and call a simple API to verify auth
    const oauth2Client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get profile to verify auth
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    res.json({
      status: 'authenticated',
      message: 'Application is authenticated with Gmail',
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal
    });
  } catch (error) {
    logger.error('Error verifying authentication status:', error);
    res.status(401).json({
      status: 'error',
      message: 'Authentication verification failed',
      error: error.message
    });
  }
});

module.exports = router; 