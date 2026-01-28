import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { ExecutionLogService } from '../services/executionLogService.js';
import type { Prisma } from '@prisma/client';

export const executionLogsRouter: RouterType = Router();

const createLogSchema = z.object({
  taskId: z.string().uuid(),
  agentId: z.string(), // Agent IDs are not UUIDs (e.g., "qa-01", "coder-01")
  step: z.number().int().min(0),
  thought: z.string().optional(),
  action: z.string().min(1),
  actionInput: z.any(), // Use z.any() for JSON - will be validated as Prisma.InputJsonValue
  observation: z.string(),
  durationMs: z.number().int().min(0).optional(),
  isLoop: z.boolean().optional(),
  errorTrace: z.string().optional(),
});

// Create new execution log
executionLogsRouter.post('/', asyncHandler(async (req, res) => {
  const logService = new ExecutionLogService(prisma);
  const input = createLogSchema.parse(req.body);

  const log = await logService.createLog({
    ...input,
    actionInput: input.actionInput as Prisma.InputJsonValue,
  });

  res.status(201).json(log);
}));

// Get all logs for a specific task
executionLogsRouter.get('/task/:taskId', asyncHandler(async (req, res) => {
  const logService = new ExecutionLogService(prisma);
  const logs = await logService.getTaskLogs(req.params.taskId);

  res.json(logs);
}));

// Get all logs for a specific agent
executionLogsRouter.get('/agent/:agentId', asyncHandler(async (req, res) => {
  const logService = new ExecutionLogService(prisma);
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const logs = await logService.getAgentLogs(req.params.agentId, limit);

  res.json(logs);
}));

// Get loop detection logs for a task
executionLogsRouter.get('/task/:taskId/loops', asyncHandler(async (req, res) => {
  const logService = new ExecutionLogService(prisma);
  const logs = await logService.getLoopLogs(req.params.taskId);

  res.json(logs);
}));

// Delete all logs for a task (cleanup)
executionLogsRouter.delete('/task/:taskId', asyncHandler(async (req, res) => {
  const logService = new ExecutionLogService(prisma);
  const result = await logService.deleteTaskLogs(req.params.taskId);

  res.json({ deleted: result.count });
}));
