const { google } = require('googleapis');
const { logger } = require('../utils/logger');

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels'
];

// Create OAuth2 client
const createOAuth2Client = () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set refresh token to acquire new access tokens
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    return oauth2Client;
  } catch (error) {
    logger.error('Error creating OAuth2 client:', error);
    throw error;
  }
};

// Initialize Gmail API service
const getGmailService = () => {
  try {
    const auth = createOAuth2Client();
    return google.gmail({ version: 'v1', auth });
  } catch (error) {
    logger.error('Error initializing Gmail API service:', error);
    throw error;
  }
};

// Get authorization URL for OAuth2
const getAuthUrl = () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Forces to approve the consent again
    });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    throw error;
  }
};

module.exports = {
  createOAuth2Client,
  getGmailService,
  getAuthUrl,
  SCOPES
}; 