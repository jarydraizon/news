#!/usr/bin/env node

const { google } = require('googleapis');
const readline = require('readline');
const dotenv = require('dotenv');
const fs = require('fs');
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Generate the auth URL
const authorizeUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Forces to approve the consent every time
});

console.log('\n1. Open this URL in your browser:');
console.log('\n' + authorizeUrl + '\n');
console.log('2. After authorizing, you will be redirected to a page that may show an error.');
console.log('3. Copy the "code" parameter from the URL or paste the entire URL.\n');

// Extract the code from a URL or use the code directly
const extractCode = (input) => {
  if (input.includes('?code=')) {
    try {
      const url = new URL(input);
      return url.searchParams.get('code');
    } catch (error) {
      // If it's not a valid URL but contains the code parameter, try to extract it
      const codeMatch = input.match(/[?&]code=([^&]+)/);
      if (codeMatch && codeMatch[1]) {
        return codeMatch[1];
      }
    }
  }
  // If no URL pattern found, assume the input is the code itself
  return input;
};

// Prompt for the authorization code
rl.question('Enter the authorization code or full URL: ', async (input) => {
  try {
    const code = extractCode(input);
    console.log('\nExtracting code:', code);
    console.log('\nExchanging authorization code for tokens...');
    
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
    
    rl.close();
  } catch (error) {
    console.error('Error exchanging authorization code for tokens:', error.message);
    rl.close();
    process.exit(1);
  }
}); 