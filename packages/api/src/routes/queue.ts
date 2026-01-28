import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import type { TaskQueueService } from '../services/taskQueue.js';
import { TaskRouter } from '../services/taskRouter.js';

export const queueRouter: RouterType = Router();

// Get queue state (pending tasks)
queueRouter.get('/', asyncHandler(async (req, res) => {
  const pendingTasks = await prisma.task.findMany({
    where: { status: 'pending' },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
    include: {
      parentTask: {
        select: { id: true, title: true },
      },
    },
  });

  const activeTasks = await prisma.task.findMany({
    where: {
      status: { in: ['assigned', 'in_progress', 'needs_human'] },
    },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  const idleAgents = await prisma.agent.findMany({
    where: { status: 'idle' },
    include: { agentType: true },
  });

  res.json({
    pending: pendingTasks,
    active: activeTasks,
    idleAgents,
    stats: {
      pendingCount: pendingTasks.length,
      activeCount: activeTasks.length,
      idleAgentCount: idleAgents.length,
    },
  });
}));

// Manually assign task to agent (micromanager mode)
queueRouter.post('/assign', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    taskId: z.string().uuid(),
    agentId: z.string(),
  });

  const { taskId, agentId } = schema.parse(req.body);

  // Verify task is pending
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.status !== 'pending') {
    res.status(400).json({ error: 'Task is not pending' });
    return;
  }

  // Verify agent is idle
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { agentType: true },
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  if (agent.status !== 'idle') {
    res.status(400).json({ error: 'Agent is not idle' });
    return;
  }

  // Check agent type compatibility
  if (task.requiredAgent && task.requiredAgent !== agent.agentType.name) {
    res.status(400).json({
      error: `Task requires ${task.requiredAgent} agent, but ${agent.name} is ${agent.agentType.name}`,
    });
    return;
  }

  const assignment = await taskQueue.assignTask(taskId, agentId);

  const updatedTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  res.json(updatedTask);
}));

// Auto-assign next task to an agent
queueRouter.post('/auto-assign', asyncHandler(async (req, res) => {
  const taskQueue = req.app.get('taskQueue') as TaskQueueService;

  const schema = z.object({
    agentId: z.string(),
  });

  const { agentId } = schema.parse(req.body);

  const assignment = await taskQueue.assignNextTask(agentId);

  if (!assignment) {
    res.json({ assigned: false, message: 'No suitable task found' });
    return;
  }

  const task = await prisma.task.findUnique({
    where: { id: assignment.taskId },
    include: {
      assignedAgent: {
        include: { agentType: true },
      },
    },
  });

  res.json({ assigned: true, task });
}));

// Smart auto-assign using intelligent task routing
queueRouter.post('/smart-assign', asyncHandler(async (req, res) => {
  const taskRouter = new TaskRouter(prisma);

  const result = await taskRouter.autoAssignNext();

  if (!result) {
    res.json({ assigned: false, message: 'No pending tasks' });
    return;
  }

  res.json({
    assigned: true,
    task: result.task,
    decision: result.decision,
  });
}));

// Get routing recommendation for a specific task
queueRouter.get('/:taskId/route', asyncHandler(async (req, res) => {
  const taskRouter = new TaskRouter(prisma);
  const { taskId } = req.params;

  const decision = await taskRouter.routeTask(taskId);

  res.json(decision);
}));

// Get file locks
queueRouter.get('/locks', asyncHandler(async (req, res) => {
  const locks = await prisma.fileLock.findMany({
    where: {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      agent: true,
      task: {
        select: { id: true, title: true },
      },
    },
  });

  res.json(locks);
}));

// Release a specific file lock (emergency override)
queueRouter.delete('/locks/:filePath', asyncHandler(async (req, res) => {
  const filePath = decodeURIComponent(req.params.filePath);

  await prisma.fileLock.delete({
    where: { filePath },
  });

  res.status(204).send();
}));
