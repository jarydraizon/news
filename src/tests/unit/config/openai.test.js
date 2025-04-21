const { OpenAI } = require('openai');
const { generateSummary, categorizeEmails } = require('../../../config/openai');
const { logger } = require('../../../utils/logger');

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: 'Mocked summary content'
        }
      }
    ]
  });
  
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('OpenAI Configuration', () => {
  // Reset mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('generateSummary', () => {
    test('should generate a summary with default options', async () => {
      // Test content
      const content = 'Test email content to summarize';
      
      // Call the function
      const summary = await generateSummary(content);
      
      // Get the mocked instance
      const mockOpenAI = new OpenAI();
      
      // Verify OpenAI was called with the right parameters
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo', // Default model
          messages: [
            expect.objectContaining({
              role: 'system',
              content: expect.any(String)
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(content)
            })
          ],
          max_tokens: 1000, // Default max tokens
          temperature: 0.3
        })
      );
      
      // Verify the returned summary
      expect(summary).toBe('Mocked summary content');
    });
    
    test('should generate a summary with custom options', async () => {
      // Test content
      const content = 'Test email content to summarize';
      const options = {
        model: 'gpt-3.5-turbo',
        maxTokens: 500
      };
      
      // Call the function
      await generateSummary(content, options);
      
      // Get the mocked instance
      const mockOpenAI = new OpenAI();
      
      // Verify OpenAI was called with the custom parameters
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo', // Custom model
          max_tokens: 500 // Custom max tokens
        })
      );
    });
    
    test('should handle errors', async () => {
      // Mock an error
      const mockError = new Error('API error');
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);
      
      // Call the function and expect it to throw
      await expect(generateSummary('Error content')).rejects.toThrow('API error');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error generating summary with OpenAI:',
        mockError
      );
    });
  });
  
  describe('categorizeEmails', () => {
    test('should categorize emails', async () => {
      // Test emails
      const emails = [
        { subject: 'Work meeting tomorrow' },
        { subject: 'Personal: Vacation plans' },
        { subject: 'Invoice #12345' }
      ];
      
      // Call the function
      const categories = await categorizeEmails(emails);
      
      // Get the mocked instance
      const mockOpenAI = new OpenAI();
      
      // Verify OpenAI was called with the right parameters
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
          messages: [
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('categorizes email')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Categorize these email subjects')
            })
          ]
        })
      );
      
      // Verify the returned categories
      expect(categories).toBe('Mocked summary content');
    });
    
    test('should handle errors', async () => {
      // Mock an error
      const mockError = new Error('Categorization error');
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(mockError);
      
      // Call the function and expect it to throw
      await expect(categorizeEmails([{ subject: 'Test' }])).rejects.toThrow('Categorization error');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error categorizing emails with OpenAI:',
        mockError
      );
    });
  });
}); 