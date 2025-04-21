#!/usr/bin/env node

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const destroyer = require('server-destroy');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Check if required environment variables exist
const requiredVars = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file and try again.');
  process.exit(1);
}

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

// Function to get and store authentication tokens
async function authenticate() {
  return new Promise((resolve, reject) => {
    // Generate the url that will be used for the authentication
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Forces to approve the consent every time, so you can get the refresh token
    });

    // Extract port from GMAIL_REDIRECT_URI
    const redirectUrl = new URL(process.env.GMAIL_REDIRECT_URI);
    const port = redirectUrl.port || (redirectUrl.protocol === 'https:' ? 443 : 80);
    
    // Start temporary local server to handle the OAuth2 callback
    const server = http.createServer(async (req, res) => {
      try {
        // Handle the OAuth callback request at a simple path that matches Google's expectations
        const reqUrl = new URL(req.url, `http://localhost:${port}`);
        const callbackPath = redirectUrl.pathname;
        
        console.log(`Received request for: ${reqUrl.pathname}, expecting: ${callbackPath}`);
        
        if (reqUrl.pathname === callbackPath) {
          // Get the code from the callback
          const qs = reqUrl.searchParams;
          const code = qs.get('code');

          if (!code) {
            throw new Error('No authorization code provided');
          }

          // Now that we have the code, we can exchange it for an access token and refresh token
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          // Return success response
          res.end('Authentication successful! You can close this page and return to the terminal.');

          // Close the server
          server.destroy();

          // Resolve the promise with the tokens
          resolve(tokens);
        }
      } catch (error) {
        // Handle any errors
        console.error('Error during authentication:', error);
        res.end('Authentication failed. Please check the console for more details.');
        server.destroy();
        reject(error);
      }
    }).listen(port, () => {
      // Open the authorization URL in the browser
      console.log(`Opening browser for authentication...`);
      console.log(`Server listening on port ${port} for callback: ${redirectUrl.pathname}`);
      open(authorizeUrl, {wait: false}).then(cp => cp.unref());
    });

    destroyer(server);
  });
}

// Main function
async function main() {
  try {
    console.log('Starting Gmail API authentication setup...');
    
    // Authenticate and get tokens
    const tokens = await authenticate();
    
    // Log tokens (in production, only show what's needed)
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
    console.log('\nYou can now use the application to access and summarize this Gmail account.');
    
  } catch (error) {
    console.error('Authentication failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main(); 