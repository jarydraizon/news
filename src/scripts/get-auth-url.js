#!/usr/bin/env node

const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels'
];

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Generate the auth URL
const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Forces to approve the consent every time, so you can get the refresh token
});

console.log('Copy and open this URL in your browser:');
console.log('\n' + authorizeUrl + '\n');
console.log('Your redirect URI is set to:', process.env.GMAIL_REDIRECT_URI); 