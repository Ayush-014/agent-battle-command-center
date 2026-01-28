import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import { ExecutorService } from '../services/executor.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import type { Server as SocketIOServer } from 'socket.io';

export const executeRouter: RouterType = Router();

const executor = new ExecutorService();

// Execute a task
executeRouter.post('/', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;
  const io = req.app.get('io') as SocketIOServer;

  const schema = z.object({
    taskId: z.string().uuid(),
    useClaude: z.boolean().default(true),
    model: z.string().optional(),
    allowFallback: z.boolean().default(true),
    stepByStep: z.boolean().default(false),
  });

  const data = schema.parse(req.body);

  // Get task
  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    include: { assignedAgent: true },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (!task.assignedAgentId) {
    res.status(400).json({ error: 'Task is not assigned to an agent' });
    return;
  }

  // Mark task as in progress
  await taskQueue.handleTaskStart(data.taskId);

  // Execute asynchronously
  const executeAsync = async () => {
    try {
      const result = await executor.executeTask({
        taskId: data.taskId,
        agentId: task.assignedAgentId!,
        taskDescription: task.description || task.title,
        expectedOutput: `Successfully completed: ${task.title}`,
        useClaude: data.useClaude,
        model: data.model,
        allowFallback: data.allowFallback,
        stepByStep: data.stepByStep,
      });

      if (result.success) {
        await taskQueue.handleTaskCompletion(data.taskId, {
          output: result.output ?? '',
          metrics: result.metrics ?? {},
        });
      } else {
        await taskQueue.handleTaskFailure(data.taskId, result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Execution error:', error);
      await taskQueue.handleTaskFailure(
        data.taskId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  // Fire and forget
  executeAsync();

  res.json({ started: true, taskId: data.taskId });
}));

// Execute single step (micromanager mode)
executeRouter.post('/step', asyncHandler(async (req, res) => {
  const io = req.app.get('io') as SocketIOServer;

  const schema = z.object({
    taskId: z.string().uuid(),
    stepNumber: z.number().min(0),
  });

  const data = schema.parse(req.body);

  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
  });

  if (!task || !task.assignedAgentId) {
    res.status(404).json({ error: 'Task not found or not assigned' });
    return;
  }

  const step = await executor.executeStep(data.taskId, task.assignedAgentId, data.stepNumber);

  if (!step) {
    res.status(500).json({ error: 'Step execution failed' });
    return;
  }

  // Emit step event
  io.emit('execution_step', {
    type: 'execution_step',
    payload: step,
    timestamp: new Date(),
  });

  res.json(step);
}));

// Approve step (micromanager mode)
executeRouter.post('/approve', asyncHandler(async (req, res) => {
  const schema = z.object({
    taskId: z.string().uuid(),
    stepNumber: z.number().min(0),
  });

  const data = schema.parse(req.body);

  const success = await executor.approveStep(data.taskId, data.stepNumber);

  if (!success) {
    res.status(500).json({ error: 'Failed to approve step' });
    return;
  }

  res.json({ approved: true });
}));

// Reject step (micromanager mode)
executeRouter.post('/reject', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    taskId: z.string().uuid(),
    stepNumber: z.number().min(0),
    reason: z.string(),
  });

  const data = schema.parse(req.body);

  const success = await executor.rejectStep(data.taskId, data.stepNumber, data.reason);

  if (!success) {
    res.status(500).json({ error: 'Failed to reject step' });
    return;
  }

  // Request human input with the rejection reason
  await taskQueue.requestHumanInput(data.taskId, `Step ${data.stepNumber} rejected: ${data.reason}`);

  res.json({ rejected: true });
}));

// Abort execution
executeRouter.post('/abort', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    taskId: z.string().uuid(),
  });

  const data = schema.parse(req.body);

  const success = await executor.abortExecution(data.taskId);

  if (success) {
    await taskQueue.abortTask(data.taskId, 'Execution aborted by user');
  }

  res.json({ aborted: success });
}));

// Health check for executor service
executeRouter.get('/health', asyncHandler(async (req, res) => {
  const health = await executor.healthCheck();
  res.json(health);
}));
