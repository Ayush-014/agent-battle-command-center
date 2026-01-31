/**
 * Memory Routes - Cross-task learning management
 *
 * Endpoints for:
 * - Listing pending/approved memories
 * - Approving/rejecting agent-proposed learnings
 * - Searching memories by task type and keywords
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';

export const memoriesRouter: RouterType = Router();

// Get pending memories for approval
memoriesRouter.get('/pending', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  const [memories, total] = await Promise.all([
    prisma.taskMemory.findMany({
      where: { approved: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.taskMemory.count({ where: { approved: false } }),
  ]);

  res.json({ memories, total, limit, offset });
}));

// Get approved memories (with optional filtering)
memoriesRouter.get('/approved', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const taskType = req.query.taskType as string;

  const where: { approved: boolean; taskType?: string } = { approved: true };
  if (taskType) {
    where.taskType = taskType;
  }

  const [memories, total] = await Promise.all([
    prisma.taskMemory.findMany({
      where,
      orderBy: [{ successCount: 'desc' }, { lastUsed: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.taskMemory.count({ where }),
  ]);

  res.json({ memories, total, limit, offset });
}));

// Search memories by keywords and task type
memoriesRouter.get('/search', asyncHandler(async (req, res) => {
  const taskType = req.query.taskType as string;
  const keywords = (req.query.keywords as string || '').split(',').filter(Boolean);
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  if (!taskType && keywords.length === 0) {
    res.status(400).json({ error: 'Provide taskType or keywords' });
    return;
  }

  // Build search conditions
  const where: {
    approved: boolean;
    taskType?: string;
    OR?: Array<{ pattern?: { contains: string; mode: 'insensitive' }; solution?: { contains: string; mode: 'insensitive' }; keywords?: { hasSome: string[] } }>;
  } = { approved: true };

  if (taskType) {
    where.taskType = taskType;
  }

  if (keywords.length > 0) {
    where.OR = [
      ...keywords.map(k => ({ pattern: { contains: k, mode: 'insensitive' as const } })),
      ...keywords.map(k => ({ solution: { contains: k, mode: 'insensitive' as const } })),
      { keywords: { hasSome: keywords } },
    ];
  }

  const memories = await prisma.taskMemory.findMany({
    where,
    orderBy: [{ successCount: 'desc' }, { lastUsed: 'desc' }],
    take: limit,
  });

  res.json({ memories, count: memories.length });
}));

// Propose a new memory (from agent learning)
memoriesRouter.post('/', asyncHandler(async (req, res) => {
  const schema = z.object({
    taskType: z.string().min(1).max(50),
    category: z.string().max(100).optional(),
    pattern: z.string().min(1),
    solution: z.string().min(1),
    errorPattern: z.string().optional(),
    codeExample: z.string().optional(),
    filePatterns: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    proposedByTask: z.string().optional(),
    proposedByAgent: z.string().optional(),
  });

  const data = schema.parse(req.body);

  const memory = await prisma.taskMemory.create({
    data: {
      ...data,
      approved: false,
    },
  });

  res.status(201).json(memory);
}));

// Approve a memory
memoriesRouter.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const approvedBy = (req.body.approvedBy as string) || 'human';

  const memory = await prisma.taskMemory.update({
    where: { id },
    data: {
      approved: true,
      approvedBy,
      approvedAt: new Date(),
    },
  });

  res.json(memory);
}));

// Reject a memory (delete it)
memoriesRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.taskMemory.delete({
    where: { id },
  });

  res.json({ success: true, message: 'Memory rejected and deleted' });
}));

// Update memory success/failure count (called when memory is used)
memoriesRouter.post('/:id/feedback', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schema = z.object({
    success: z.boolean(),
  });

  const { success } = schema.parse(req.body);

  const memory = await prisma.taskMemory.update({
    where: { id },
    data: success
      ? { successCount: { increment: 1 }, lastUsed: new Date() }
      : { failureCount: { increment: 1 }, lastUsed: new Date() },
  });

  res.json(memory);
}));

// Get architectural context (special memory type)
memoriesRouter.get('/architecture', asyncHandler(async (req, res) => {
  // Find the most recent approved architecture memory
  const archContext = await prisma.taskMemory.findFirst({
    where: {
      taskType: 'architecture',
      approved: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!archContext) {
    res.status(404).json({
      error: 'No architectural context found',
      hint: 'Run: node scripts/generate-arch-context.js',
    });
    return;
  }

  // Parse the solution field which contains the JSON context
  try {
    const context = JSON.parse(archContext.solution);
    res.json({
      id: archContext.id,
      generatedAt: context.generated_at,
      version: context.version,
      context,
    });
  } catch {
    res.json({
      id: archContext.id,
      context: archContext.solution,
    });
  }
}));

// Get memory stats
memoriesRouter.get('/stats', asyncHandler(async (req, res) => {
  const [total, approved, pending, byTaskType] = await Promise.all([
    prisma.taskMemory.count(),
    prisma.taskMemory.count({ where: { approved: true } }),
    prisma.taskMemory.count({ where: { approved: false } }),
    prisma.taskMemory.groupBy({
      by: ['taskType'],
      where: { approved: true },
      _count: { id: true },
      _sum: { successCount: true },
    }),
  ]);

  res.json({
    total,
    approved,
    pending,
    byTaskType: byTaskType.map(t => ({
      taskType: t.taskType,
      count: t._count.id,
      totalSuccesses: t._sum.successCount || 0,
    })),
  });
}));
