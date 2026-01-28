import { Router, type Router as RouterType } from 'express';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';

export const metricsRouter: RouterType = Router();

// Get overview metrics
metricsRouter.get('/overview', asyncHandler(async (req, res) => {
  const [
    totalTasks,
    pendingTasks,
    activeTasks,
    completedTasks,
    failedTasks,
    totalAgents,
    busyAgents,
    idleAgents,
  ] = await Promise.all([
    prisma.task.count(),
    prisma.task.count({ where: { status: 'pending' } }),
    prisma.task.count({ where: { status: { in: ['assigned', 'in_progress', 'needs_human'] } } }),
    prisma.task.count({ where: { status: 'completed' } }),
    prisma.task.count({ where: { status: { in: ['failed', 'aborted'] } } }),
    prisma.agent.count(),
    prisma.agent.count({ where: { status: 'busy' } }),
    prisma.agent.count({ where: { status: 'idle' } }),
  ]);

  // Calculate totals from completed tasks
  const taskMetrics = await prisma.task.aggregate({
    where: { status: 'completed' },
    _sum: {
      apiCreditsUsed: true,
      timeSpentMs: true,
    },
  });

  const successRate = totalTasks > 0
    ? Math.round((completedTasks / (completedTasks + failedTasks || 1)) * 100) / 100
    : 0;

  res.json({
    totalTasks,
    pendingTasks,
    activeTasks,
    completedTasks,
    failedTasks,
    totalAgents,
    busyAgents,
    idleAgents,
    totalApiCredits: Number(taskMetrics._sum.apiCreditsUsed || 0),
    totalTimeMs: taskMetrics._sum.timeSpentMs || 0,
    successRate,
  });
}));

// Get per-agent analytics
metricsRouter.get('/agents/:id', asyncHandler(async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const executions = await prisma.taskExecution.findMany({
    where: { agentId: req.params.id },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      task: {
        select: { id: true, title: true, taskType: true },
      },
    },
  });

  const executionMetrics = await prisma.taskExecution.aggregate({
    where: { agentId: req.params.id },
    _sum: {
      apiCreditsUsed: true,
      durationMs: true,
    },
    _count: true,
    _avg: {
      durationMs: true,
    },
  });

  const completedCount = await prisma.taskExecution.count({
    where: { agentId: req.params.id, status: 'completed' },
  });

  const failedCount = await prisma.taskExecution.count({
    where: { agentId: req.params.id, status: 'failed' },
  });

  res.json({
    agent,
    stats: agent.stats,
    executions,
    metrics: {
      totalExecutions: executionMetrics._count,
      completedExecutions: completedCount,
      failedExecutions: failedCount,
      totalApiCredits: Number(executionMetrics._sum.apiCreditsUsed || 0),
      totalTimeMs: executionMetrics._sum.durationMs || 0,
      avgDurationMs: executionMetrics._avg.durationMs || 0,
    },
  });
}));

// Get timeline data
metricsRouter.get('/timeline', asyncHandler(async (req, res) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  const executions = await prisma.taskExecution.findMany({
    where: {
      startedAt: { gte: startTime },
    },
    select: {
      status: true,
      apiCreditsUsed: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  // Group by hour
  const timeline: Record<string, {
    timestamp: string;
    tasksCompleted: number;
    tasksFailed: number;
    apiCreditsUsed: number;
  }> = {};

  for (const exec of executions) {
    const hour = new Date(exec.startedAt);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();

    if (!timeline[key]) {
      timeline[key] = {
        timestamp: key,
        tasksCompleted: 0,
        tasksFailed: 0,
        apiCreditsUsed: 0,
      };
    }

    if (exec.status === 'completed') {
      timeline[key].tasksCompleted++;
    } else if (exec.status === 'failed') {
      timeline[key].tasksFailed++;
    }

    timeline[key].apiCreditsUsed += Number(exec.apiCreditsUsed || 0);
  }

  res.json(Object.values(timeline));
}));

// Get task type distribution
metricsRouter.get('/distribution', asyncHandler(async (req, res) => {
  const byType = await prisma.task.groupBy({
    by: ['taskType'],
    _count: true,
  });

  const byStatus = await prisma.task.groupBy({
    by: ['status'],
    _count: true,
  });

  const byAgent = await prisma.task.groupBy({
    by: ['requiredAgent'],
    _count: true,
  });

  res.json({
    byType: byType.map(t => ({ type: t.taskType, count: t._count })),
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
    byAgent: byAgent.map(a => ({ agent: a.requiredAgent || 'any', count: a._count })),
  });
}));
