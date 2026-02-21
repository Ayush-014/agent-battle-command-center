/**
 * Async Validation API Routes
 *
 * Provides endpoints for monitoring background validation status,
 * retrieving results, triggering deferred retries, and resetting state.
 */

import { Router, type Router as RouterType, type Request } from 'express';
import { asyncHandler } from '../types/index.js';
import type { AsyncValidationService } from '../services/asyncValidationService.js';

export const validationRouter: RouterType = Router();

function getService(req: Request): AsyncValidationService {
  const service = req.app.get('asyncValidation') as AsyncValidationService | undefined;
  if (!service) {
    throw new Error('AsyncValidationService not initialized');
  }
  return service;
}

/**
 * GET /api/validation/status
 * Returns current validation pipeline status counts
 */
validationRouter.get('/status', asyncHandler(async (req, res) => {
  const service = getService(req);
  res.json(service.getStatus());
}));

/**
 * GET /api/validation/results
 * Returns all validation results
 */
validationRouter.get('/results', asyncHandler(async (req, res) => {
  const service = getService(req);
  const results = service.getResults();

  // Support filtering by taskId query param
  const taskId = req.query.taskId as string | undefined;
  if (taskId) {
    const result = service.getResult(taskId);
    res.json(result || null);
    return;
  }

  res.json(results);
}));

/**
 * POST /api/validation/retry
 * Triggers processing of the retry queue (Phase 1 Ollama → Phase 2 Haiku)
 * Returns results summary when complete
 */
validationRouter.post('/retry', asyncHandler(async (req, res) => {
  const service = getService(req);

  // Wait for any pending validations to finish first
  const maxWaitMs = 30000;
  const start = Date.now();
  while (service.hasPendingValidations() && Date.now() - start < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const results = await service.processRetryQueue();
  res.json(results);
}));

/**
 * POST /api/validation/clear
 * Resets all validation state (for stress test cleanup between runs)
 */
validationRouter.post('/clear', asyncHandler(async (req, res) => {
  const service = getService(req);
  service.clearResults();
  res.json({ cleared: true });
}));
