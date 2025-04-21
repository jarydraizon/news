const { OpenAI } = require('openai');
const { logger } = require('../utils/logger');

// Initialize OpenAI client with a fallback for missing API key
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-development'
  });
  logger.info('OpenAI client initialized');
} catch (error) {
  logger.error('Error initializing OpenAI client:', error);
  // Create a mock client that logs instead of making real API calls
  openai = {
    chat: {
      completions: {
        create: async () => {
          logger.warn('OpenAI API call attempted without valid API key');
          return { 
            choices: [{ 
              message: { 
                content: 'This is a placeholder response because OpenAI API key is missing' 
              } 
            }] 
          };
        }
      }
    }
  };
}

// Default model to use for summarization
const DEFAULT_MODEL = 'gpt-4-turbo';

// Function to generate text summaries
const generateSummary = async (content, options = {}) => {
  try {
    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 1000;
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that summarizes email content. Extract the key topics, important information, and action items. Organize the summary by topic areas.'
        },
        {
          role: 'user',
          content: `Summarize the following email content:\n\n${content}`
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3, // Lower temperature for more focused, deterministic responses
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Error generating summary with OpenAI:', error);
    throw error;
  }
};

// Function to categorize emails by topic
const categorizeEmails = async (emails) => {
  try {
    // Prepare email subjects as a list for categorization
    const emailSubjects = emails.map(email => email.subject || 'No Subject').join('\n');
    
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that categorizes email subjects into logical topic groups. Identify 3-7 key topics.'
        },
        {
          role: 'user',
          content: `Categorize these email subjects into logical topic groups:\n\n${emailSubjects}`
        }
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Error categorizing emails with OpenAI:', error);
    throw error;
  }
};

module.exports = {
  openai,
  generateSummary,
  categorizeEmails,
  DEFAULT_MODEL
}; 