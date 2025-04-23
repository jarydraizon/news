const { OpenAI } = require('openai');
const { logger } = require('../utils/logger');

// Create a factory function for OpenAI client instead of initializing at module load time
let openaiInstance = null;
let apiKeyValid = false;

// Initialize OpenAI client with the API key - can be called multiple times with different keys
const initOpenAI = (apiKey = process.env.OPENAI_API_KEY) => {
  try {
    console.log(`Initializing OpenAI with${apiKey ? '' : 'out'} API key`);
    if (apiKey) {
      console.log(`API key starts with: ${apiKey.substring(0, 7)}...`);
    }
    
    // Check if the API key exists and has a valid format
    if (!apiKey) {
      logger.warn('OpenAI API key is missing. API calls will not work.');
      console.warn('WARNING: OpenAI API key is missing. API calls will not work.');
      apiKeyValid = false;
    } else if (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-')) {
      apiKeyValid = true;
      console.log('OpenAI API key format appears valid. Proceeding with API integration.');
    } else {
      logger.warn('OpenAI API key is improperly formatted. API calls will not work.');
      console.warn('WARNING: OpenAI API key is improperly formatted. API calls will not work.');
      apiKeyValid = false;
    }
    
    // Create the OpenAI client
    if (apiKeyValid) {
      openaiInstance = new OpenAI({ apiKey });
      logger.info('OpenAI client initialized with provided API key');
    } else {
      // Create a placeholder client with dummy key for development
      openaiInstance = {
        chat: {
          completions: {
            create: async () => {
              logger.warn('OpenAI API call attempted without valid client');
              return { 
                choices: [{ 
                  message: { 
                    content: 'This is a placeholder response because OpenAI client could not be initialized.' 
                  } 
                }] 
              };
            }
          }
        }
      };
      logger.info('Mock OpenAI client initialized (API calls will provide mock responses)');
    }
    
    return { openai: openaiInstance, apiKeyValid };
  } catch (error) {
    logger.error('Error initializing OpenAI client:', error);
    console.error('Error initializing OpenAI client:', error.message);
    apiKeyValid = false;
    
    // Create a mock client that logs instead of making real API calls
    openaiInstance = {
      chat: {
        completions: {
          create: async () => {
            logger.warn('OpenAI API call attempted without valid client');
            return { 
              choices: [{ 
                message: { 
                  content: 'This is a placeholder response because OpenAI client could not be initialized.' 
                } 
              }] 
            };
          }
        }
      }
    };
    
    return { openai: openaiInstance, apiKeyValid: false };
  }
};

// Default model to use for summarization
const DEFAULT_MODEL = 'gpt-3.5-turbo';

// Function to generate text summaries
const generateSummary = async (content, options = {}) => {
  // Initialize OpenAI if not already done
  if (!openaiInstance) {
    const { openai } = initOpenAI();
    openaiInstance = openai;
  }
  
  try {
    // Check if we have a valid API key
    if (!apiKeyValid) {
      logger.warn('OpenAI API key is invalid. Returning mock summary.');
      console.warn('WARNING: OpenAI API key is invalid. Returning mock summary.');
      return `This is a mock summary because no valid OpenAI API key was provided. 
              Please set a valid OPENAI_API_KEY in your .env file to generate real summaries.
              
              The email contained information from newsletters that would normally be summarized here.`;
    }
    
    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens || 1000;
    
    console.log(`Attempting to generate summary using model ${model} with OpenAI API...`);
    const response = await openaiInstance.chat.completions.create({
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

    console.log('Successfully received summary from OpenAI');
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Error generating summary with OpenAI:', error);
    console.error('Error generating summary with OpenAI:', error.message);
    
    // More specific error handling
    if (error.status === 401) {
      return `Error: Authentication failed. Your API key is invalid or expired. 
              Please check your OpenAI API key and try again.`;
    } else if (error.status === 429) {
      return `Error: Rate limit exceeded. The API request was rate limited.
              Please try again later or check your usage limits.`;
    } else if (error.status === 404) {
      return `Error: Model not found. The specified model (${options.model || DEFAULT_MODEL}) does not exist or you don't have access to it.
              Please check the model name or your access permissions.`;
    }
    
    return `Error generating summary: ${error.message}. 
            
            This is a fallback response because the OpenAI API call failed.
            Please check your API key and try again.`;
  }
};

// Function to categorize emails by topic
const categorizeEmails = async (emails) => {
  // Initialize OpenAI if not already done
  if (!openaiInstance) {
    const { openai } = initOpenAI();
    openaiInstance = openai;
  }
  
  try {
    // Check if we have a valid API key
    if (!apiKeyValid) {
      logger.warn('OpenAI API key is invalid. Returning mock categories.');
      console.warn('WARNING: OpenAI API key is invalid. Returning mock categories.');
      return `Technology Updates: Latest tech news and updates
              Business News: Business and financial updates
              Industry Trends: Current trends in the industry`;
    }
    
    // Prepare email subjects as a list for categorization
    const emailSubjects = emails.map(email => email.subject || 'No Subject').join('\n');
    
    console.log('Attempting to categorize emails using OpenAI API...');
    const response = await openaiInstance.chat.completions.create({
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

    console.log('Successfully received categories from OpenAI');
    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Error categorizing emails with OpenAI:', error);
    console.error('Error categorizing emails with OpenAI:', error.message);
    
    // More specific error handling
    if (error.status === 401) {
      console.error('Authentication failed: Invalid API key');
    } else if (error.status === 429) {
      console.error('Rate limit exceeded. Try again later.');
    }
    
    return `Technology Updates: Latest tech news and updates
            Business News: Business and financial updates
            Industry Trends: Current trends in the industry`;
  }
};

module.exports = {
  initOpenAI,
  generateSummary,
  categorizeEmails,
  DEFAULT_MODEL
}; 