import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireApiKey, optionalApiKey } from './auth.js';

// Mock config
jest.mock('../config.js', () => ({
  config: {
    auth: {
      apiKey: 'test-api-key-12345',
    },
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      query: {},
      path: '/api/tasks',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('requireApiKey', () => {
    it('should allow health check without API key', () => {
      mockRequest.path = '/health';

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests without API key', () => {
      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: expect.stringContaining('API key required'),
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid API key', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid API key',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key in header', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key in query param', () => {
      mockRequest.query = { api_key: 'test-api-key-12345' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should prefer header over query param', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };
      mockRequest.query = { api_key: 'wrong-key' };

      requireApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalApiKey', () => {
    it('should mark request as authenticated with valid key', () => {
      mockRequest.headers = { 'x-api-key': 'test-api-key-12345' };

      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(true);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should mark request as unauthenticated without key', () => {
      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(false);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should mark request as unauthenticated with invalid key', () => {
      mockRequest.headers = { 'x-api-key': 'wrong-key' };

      optionalApiKey(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect((mockRequest as any).authenticated).toBe(false);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
