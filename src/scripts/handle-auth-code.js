#!/usr/bin/env node

const { google } = require('googleapis');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Check if code is provided
const code = process.argv[2];
if (!code) {
  console.error('Please provide the authorization code as an argument.');
  console.error('Usage: node handle-auth-code.js <code>');
  process.exit(1);
}

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Exchange auth code for tokens
async function getTokens() {
  try {
    console.log('Exchanging authorization code for tokens...');
    
    // Get tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Log tokens
    console.log('\nAuthentication successful!');
    console.log('\nYour OAuth2 refresh token (add this to your .env file):');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    
    // Store tokens in a file for backup
    const tokenFile = path.join(__dirname, '../../token.json');
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
    console.log(`\nTokens also saved to ${tokenFile}`);
    
    // Verify the authentication by getting the user's profile
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    console.log(`\nAuthenticated for Gmail account: ${profile.data.emailAddress}`);
    console.log(`Total emails: ${profile.data.messagesTotal}`);
  } catch (error) {
    console.error('Error exchanging authorization code for tokens:', error.message);
    process.exit(1);
  }
}

getTokens(); 