#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Summary = require('../models/summary');
const { sendEmail } = require('../services/notificationService');
const { logger } = require('../utils/logger');

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) {
  console.log(`.env file exists at ${envPath}`);
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  console.log('Parsed environment variables:', Object.keys(envConfig));
  
  dotenv.config({ path: envPath });
} else {
  console.log(`.env file does not exist at ${envPath}`);
  dotenv.config();
}

// Log environment variables after loading
console.log('Environment variables after loading:');
console.log(`RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'Yes' : 'No'}`);
if (process.env.RESEND_API_KEY) {
  console.log(`RESEND_API_KEY starts with: ${process.env.RESEND_API_KEY.substring(0, 5)}...`);
}

// Parse command line arguments
const argv = process.argv.slice(2);
const args = {};
argv.forEach(arg => {
  const [key, value] = arg.split('=');
  if (key && value) {
    args[key.replace('--', '')] = value;
  }
});

// Get recipient email from args or env
const recipientEmail = args.email || process.env.SUMMARY_RECIPIENT_EMAIL || 'jraizon@gmail.com';

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
    console.log('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Send the latest summary email
async function sendLatestSummary() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Get the latest summary
    const latestSummary = await Summary.findOne().sort({ createdAt: -1 });
    
    if (!latestSummary) {
      console.log('No summaries found in the database');
      return;
    }
    
    console.log(`Found latest summary from ${latestSummary.date.toDateString()}`);
    console.log(`Summary contains ${latestSummary.emailCount} emails`);
    console.log(`Categories: ${latestSummary.topicCategories.map(c => c.name || c.description).join(', ')}`);
    
    // Format email HTML
    let emailHtml = `<h1>Newsletter Summary - ${latestSummary.date.toDateString()}</h1>`;
    emailHtml += `<p><strong>Newsletters Processed:</strong> ${latestSummary.emailCount}</p>`;
    
    if (latestSummary.topicCategories && latestSummary.topicCategories.length > 0) {
      emailHtml += '<h2>Topics Overview</h2><ul>';
      latestSummary.topicCategories.forEach(category => {
        emailHtml += `<li>${category.description || category.name}</li>`;
      });
      emailHtml += '</ul>';
    }
    
    emailHtml += '<h2>Summary</h2>';
    emailHtml += `<div>${latestSummary.content.replace(/\n/g, '<br>')}</div>`;
    
    // Send email
    console.log(`Sending summary email to ${recipientEmail}...`);
    await sendEmail({
      to: recipientEmail,
      subject: `Newsletter Summary - ${latestSummary.date.toDateString()} [Test]`,
      html: emailHtml
    });
    
    console.log('Summary email sent successfully');
    
  } catch (error) {
    console.error('Error sending latest summary:', error);
    logger.error('Error sending latest summary:', error);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the script
sendLatestSummary(); 