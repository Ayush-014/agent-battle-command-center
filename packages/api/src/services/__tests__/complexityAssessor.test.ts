import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  getHaikuComplexityAssessment,
  getDualComplexityAssessment,
  validateComplexityWithHaiku,
} from '../complexityAssessor.js';
import Anthropic from '@anthropic-ai/sdk';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk');

// Mock rate limiter
jest.mock('../rateLimiter.js', () => ({
  rateLimiter: {
    waitForCapacity: jest.fn().mockResolvedValue(undefined),
    recordUsage: jest.fn(),
  },
}));

describe('Complexity Assessor', () => {
  let mockCreate: ReturnType<typeof jest.fn>;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, ANTHROPIC_API_KEY: 'test-key' };

    mockCreate = jest.fn();
    (Anthropic as any).mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    }));
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('getHaikuComplexityAssessment', () => {
    it('should return null when API key is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = await getHaikuComplexityAssessment(
        'Test Task',
        'Simple description'
      );

      expect(result).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should parse valid JSON response from Haiku', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: `{
            "complexity": 5,
            "reasoning": "Task requires multiple functions",
            "factors": ["multi-step", "validation", "error-handling"]
          }`,
        }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      const result = await getHaikuComplexityAssessment(
        'Create user registration',
        'Build a user registration endpoint with validation'
      );

      expect(result).toEqual({
        complexity: 5,
        reasoning: 'Task requires multiple functions',
        factors: ['multi-step', 'validation', 'error-handling'],
      });
    });

    it('should clamp complexity to 1-10 range', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 15, "reasoning": "Very complex", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(10);
    });

    it('should clamp negative complexity to 1', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": -5, "reasoning": "Invalid", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(1);
    });

    it('should extract JSON from markdown code blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: `Here's my assessment:\n\n\`\`\`json\n{
            "complexity": 7,
            "reasoning": "Complex algorithm required",
            "factors": ["algorithm", "optimization"]
          }\n\`\`\``,
        }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result?.complexity).toBe(7);
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result).toBeNull();
    });

    it('should return null when response is not text', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'image', source: { type: 'base64', data: 'xxx' } }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result).toBeNull();
    });

    it('should return null when JSON cannot be parsed', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Invalid JSON response' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getHaikuComplexityAssessment('Test', 'Test');

      expect(result).toBeNull();
    });

    it('should include task title and description in prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"complexity": 5, "reasoning": "Test", "factors": []}' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      await getHaikuComplexityAssessment(
        'Build API endpoint',
        'Create a REST API for user management'
      );

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Build API endpoint');
      expect(prompt).toContain('Create a REST API for user management');
    });
  });

  describe('getDualComplexityAssessment', () => {
    it('should use router complexity when Haiku is unavailable', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await getDualComplexityAssessment(
        'Test Task',
        'Description',
        6
      );

      expect(result.complexity).toBe(6);
      expect(result.complexitySource).toBe('router');
      expect(result.complexityReasoning).toContain('Haiku assessment unavailable');
    });

    it('should use Haiku score when diff >= 2 (semantic complexity)', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 9, "reasoning": "LRU cache requires advanced data structures", "factors": ["algorithm", "data-structure"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await getDualComplexityAssessment(
        'LRU Cache',
        'Implement an LRU cache',
        5 // Router underestimated
      );

      expect(result.complexity).toBe(9); // Use Haiku directly
      expect(result.complexitySource).toBe('dual');
      expect(result.complexityReasoning).toContain('using Haiku - semantic complexity');
      expect(result.complexityReasoning).toContain('Router: 5');
      expect(result.complexityReasoning).toContain('Haiku: 9');
    });

    it('should use weighted average when Haiku diff <= -2', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 3, "reasoning": "Simple task", "factors": ["basic"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getDualComplexityAssessment(
        'Add function',
        'Add a simple addition function',
        8 // Router overestimated
      );

      // weighted average: 8 * 0.6 + 3 * 0.4 = 4.8 + 1.2 = 6.0
      expect(result.complexity).toBe(6.0);
      expect(result.complexitySource).toBe('dual');
    });

    it('should use simple average when scores are close', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 6, "reasoning": "Moderate task", "factors": ["validation"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getDualComplexityAssessment(
        'Validate input',
        'Add input validation',
        5
      );

      // Simple average: (5 + 6) / 2 = 5.5
      expect(result.complexity).toBe(5.5);
      expect(result.complexitySource).toBe('dual');
    });

    it('should round final complexity to 1 decimal place', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 7, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await getDualComplexityAssessment('Test', 'Test', 6);

      // Average: (6 + 7) / 2 = 6.5
      expect(result.complexity).toBe(6.5);
      expect(Number.isInteger(result.complexity * 10)).toBe(true);
    });

    it('should include reasoning from Haiku in final assessment', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 7, "reasoning": "Requires API integration and error handling", "factors": ["api", "error-handling"]}',
        }],
        usage: { input_tokens: 100, output_tokens: 40 },
      });

      const result = await getDualComplexityAssessment(
        'API Integration',
        'Integrate third-party API',
        6
      );

      expect(result.complexityReasoning).toContain('Requires API integration and error handling');
    });
  });

  describe('validateComplexityWithHaiku', () => {
    it('should mark as accurate when within 2 points', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 7, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await validateComplexityWithHaiku('Test', 'Test', 6);

      expect(result.isAccurate).toBe(true);
      expect(result.suggestedComplexity).toBe(7);
      expect(result.difference).toBe(1);
    });

    it('should mark as inaccurate when difference > 2', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 9, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await validateComplexityWithHaiku('Test', 'Test', 5);

      expect(result.isAccurate).toBe(false);
      expect(result.suggestedComplexity).toBe(9);
      expect(result.difference).toBe(4);
    });

    it('should return accurate=true when Haiku unavailable', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await validateComplexityWithHaiku('Test', 'Test', 6);

      expect(result.isAccurate).toBe(true);
      expect(result.suggestedComplexity).toBe(6);
      expect(result.difference).toBe(0);
    });

    it('should handle exact match', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: '{"complexity": 5, "reasoning": "Test", "factors": []}',
        }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const result = await validateComplexityWithHaiku('Test', 'Test', 5);

      expect(result.isAccurate).toBe(true);
      expect(result.suggestedComplexity).toBe(5);
      expect(result.difference).toBe(0);
    });
  });
});
