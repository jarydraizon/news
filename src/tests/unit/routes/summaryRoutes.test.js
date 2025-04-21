const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const routes = require('../../../routes');
const Summary = require('../../../models/summary');
const { createDailySummary, distributeSummary, startEmailSummaryJob } = require('../../../services/summaryService');

// Mock the summary service
jest.mock('../../../services/summaryService');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api', routes);

describe('Summary Routes', () => {
  // Setup test data
  beforeEach(async () => {
    // Clear the summaries collection
    await Summary.deleteMany({});
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('GET /api/summaries', () => {
    test('should return list of summaries', async () => {
      // Create test summaries
      const summaries = [
        {
          date: new Date('2023-01-01'),
          content: 'Summary 1',
          emailCount: 5,
          emailIds: [],
          topicCategories: [{ name: 'Cat1', description: 'Category 1' }],
          isDistributed: true,
          distributedAt: new Date('2023-01-01T12:00:00')
        },
        {
          date: new Date('2023-01-02'),
          content: 'Summary 2',
          emailCount: 3,
          emailIds: [],
          topicCategories: [{ name: 'Cat2', description: 'Category 2' }],
          isDistributed: false
        }
      ];
      
      await Summary.insertMany(summaries);
      
      // Make the request
      const response = await request(app)
        .get('/api/summaries')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.data.summaries.length).toBe(2);
      expect(response.body.data.pagination.total).toBe(2);
    });
    
    test('should filter summaries by date range', async () => {
      // Create test summaries with different dates
      const summaries = [
        {
          date: new Date('2023-01-01'),
          content: 'January 1',
          emailCount: 5,
          emailIds: []
        },
        {
          date: new Date('2023-02-01'),
          content: 'February 1',
          emailCount: 3,
          emailIds: []
        },
        {
          date: new Date('2023-03-01'),
          content: 'March 1',
          emailCount: 7,
          emailIds: []
        }
      ];
      
      await Summary.insertMany(summaries);
      
      // Make the request with date filter
      const response = await request(app)
        .get('/api/summaries')
        .query({
          startDate: '2023-01-15',
          endDate: '2023-02-15'
        })
        .expect(200);
      
      // Verify filtered results
      expect(response.body.data.summaries.length).toBe(1);
      expect(new Date(response.body.data.summaries[0].date).getMonth()).toBe(1); // February
    });
    
    test('should filter by distribution status', async () => {
      // Create test summaries with different distribution status
      const summaries = [
        {
          date: new Date('2023-01-01'),
          content: 'Distributed',
          emailCount: 5,
          emailIds: [],
          isDistributed: true,
          distributedAt: new Date()
        },
        {
          date: new Date('2023-01-02'),
          content: 'Not Distributed',
          emailCount: 3,
          emailIds: [],
          isDistributed: false
        }
      ];
      
      await Summary.insertMany(summaries);
      
      // Make the request with distributed filter
      const response = await request(app)
        .get('/api/summaries')
        .query({ distributed: 'true' })
        .expect(200);
      
      // Verify filtered results
      expect(response.body.data.summaries.length).toBe(1);
      expect(response.body.data.summaries[0].isDistributed).toBe(true);
    });
  });
  
  describe('GET /api/summaries/:id', () => {
    test('should return a single summary by ID', async () => {
      // Create a test summary
      const summary = new Summary({
        date: new Date('2023-01-01'),
        content: 'Test summary content',
        emailCount: 5,
        emailIds: [new mongoose.Types.ObjectId()],
        topicCategories: [{ name: 'Test', description: 'Test Category' }]
      });
      
      await summary.save();
      
      // Make the request
      const response = await request(app)
        .get(`/api/summaries/${summary._id}`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.data._id).toBe(summary._id.toString());
      expect(response.body.data.content).toBe(summary.content);
    });
    
    test('should return 404 for non-existent summary', async () => {
      // Generate a non-existent ID
      const nonExistentId = new mongoose.Types.ObjectId();
      
      // Make the request
      const response = await request(app)
        .get(`/api/summaries/${nonExistentId}`)
        .expect('Content-Type', /json/)
        .expect(404);
      
      // Verify response
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });
  });
  
  describe('POST /api/summaries/generate', () => {
    test('should generate a summary for a specific date', async () => {
      // Mock successful summary creation
      const mockSummary = {
        _id: new mongoose.Types.ObjectId(),
        date: new Date('2023-01-01'),
        content: 'Generated summary content',
        emailCount: 10,
        emailIds: []
      };
      
      createDailySummary.mockResolvedValue(mockSummary);
      
      // Make the request
      const response = await request(app)
        .post('/api/summaries/generate')
        .send({ date: '2023-01-01' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.data.summaryId).toBe(mockSummary._id.toString());
      expect(response.body.data.emailCount).toBe(mockSummary.emailCount);
      
      // Verify the service function was called with the right date
      expect(createDailySummary).toHaveBeenCalledWith(expect.any(Date));
    });
    
    test('should return 404 if no emails found for date', async () => {
      // Mock null return (no emails found)
      createDailySummary.mockResolvedValue(null);
      
      // Make the request
      const response = await request(app)
        .post('/api/summaries/generate')
        .send({ date: '2023-01-01' })
        .expect('Content-Type', /json/)
        .expect(404);
      
      // Verify response
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('No emails found');
    });
    
    test('should handle errors during summary generation', async () => {
      // Mock error during summary creation
      createDailySummary.mockRejectedValue(new Error('Generation error'));
      
      // Make the request
      const response = await request(app)
        .post('/api/summaries/generate')
        .send({ date: '2023-01-01' })
        .expect('Content-Type', /json/)
        .expect(500);
      
      // Verify response
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Failed to generate summary');
    });
  });
  
  describe('POST /api/summaries/:id/distribute', () => {
    test('should distribute a summary', async () => {
      // Create a mock summary with distribution info
      const mockSummary = {
        _id: new mongoose.Types.ObjectId(),
        date: new Date('2023-01-01'),
        content: 'Summary to distribute',
        emailCount: 5,
        isDistributed: true,
        distributedAt: new Date(),
        distributionRecipients: ['recipient@example.com']
      };
      
      // Mock the service function
      distributeSummary.mockResolvedValue(mockSummary);
      
      // Make the request
      const response = await request(app)
        .post(`/api/summaries/${mockSummary._id}/distribute`)
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.data.summaryId).toBe(mockSummary._id.toString());
      expect(response.body.data.recipients).toEqual(mockSummary.distributionRecipients);
      
      // Verify service was called with the right ID
      expect(distributeSummary).toHaveBeenCalledWith(mockSummary._id.toString());
    });
    
    test('should handle errors during distribution', async () => {
      // Generate a test ID
      const testId = new mongoose.Types.ObjectId();
      
      // Mock distribution error
      distributeSummary.mockRejectedValue(new Error('Distribution error'));
      
      // Make the request
      const response = await request(app)
        .post(`/api/summaries/${testId}/distribute`)
        .expect('Content-Type', /json/)
        .expect(500);
      
      // Verify response
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Failed to distribute summary');
    });
  });
  
  describe('POST /api/summaries/job/run', () => {
    test('should start the email summary job', async () => {
      // Mock the job function to resolve successfully
      startEmailSummaryJob.mockResolvedValue();
      
      // Make the request
      const response = await request(app)
        .post('/api/summaries/job/run')
        .expect('Content-Type', /json/)
        .expect(200);
      
      // Verify response
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Email summary job started');
      
      // Verify the job was called
      expect(startEmailSummaryJob).toHaveBeenCalled();
    });
  });
}); 