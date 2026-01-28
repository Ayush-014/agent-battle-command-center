import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';

export const codeReviewsRouter: RouterType = Router();

// Get code review for a task
codeReviewsRouter.get('/task/:taskId', asyncHandler(async (req, res) => {
  const review = await prisma.codeReview.findFirst({
    where: { taskId: req.params.taskId },
    orderBy: { createdAt: 'desc' },
  });

  if (!review) {
    res.status(404).json({ error: 'No code review found for this task' });
    return;
  }

  res.json(review);
}));

// Get all code reviews (with pagination)
codeReviewsRouter.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as string;

  const where = status ? { status } : {};

  const [reviews, total] = await Promise.all([
    prisma.codeReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.codeReview.count({ where }),
  ]);

  res.json({ reviews, total, limit, offset });
}));

// Create a code review
codeReviewsRouter.post('/', asyncHandler(async (req, res) => {
  const schema = z.object({
    taskId: z.string().uuid(),
    reviewerId: z.string().optional(),
    reviewerModel: z.string().optional(),
    initialComplexity: z.number(),
    opusComplexity: z.number().optional(),
    findings: z.array(z.object({
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      category: z.string(),
      description: z.string(),
      location: z.string().optional(),
      suggestion: z.string().optional(),
    })).default([]),
    summary: z.string().optional(),
    codeQualityScore: z.number().min(0).max(10).optional(),
    status: z.enum(['pending', 'approved', 'needs_fixes', 'rejected']).default('pending'),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalCost: z.number().optional(),
  });

  const data = schema.parse(req.body);

  const review = await prisma.codeReview.create({
    data: {
      ...data,
      totalCost: data.totalCost ? data.totalCost : undefined,
    },
  });

  res.status(201).json(review);
}));

// Update a code review (for fix tracking)
codeReviewsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const schema = z.object({
    status: z.enum(['pending', 'approved', 'needs_fixes', 'rejected']).optional(),
    fixAttempts: z.number().optional(),
    fixedByAgentId: z.string().optional(),
    fixedByModel: z.string().optional(),
    findings: z.array(z.any()).optional(),
    summary: z.string().optional(),
    codeQualityScore: z.number().min(0).max(10).optional(),
    opusComplexity: z.number().optional(),
  });

  const data = schema.parse(req.body);

  const review = await prisma.codeReview.update({
    where: { id: req.params.id },
    data,
  });

  res.json(review);
}));

// Get review stats summary
codeReviewsRouter.get('/stats', asyncHandler(async (req, res) => {
  const [
    total,
    approved,
    needsFixes,
    avgQualityScore,
    totalCost,
  ] = await Promise.all([
    prisma.codeReview.count(),
    prisma.codeReview.count({ where: { status: 'approved' } }),
    prisma.codeReview.count({ where: { status: 'needs_fixes' } }),
    prisma.codeReview.aggregate({ _avg: { codeQualityScore: true } }),
    prisma.codeReview.aggregate({ _sum: { totalCost: true } }),
  ]);

  res.json({
    total,
    approved,
    needsFixes,
    approvalRate: total > 0 ? (approved / total * 100).toFixed(1) : 0,
    avgQualityScore: avgQualityScore._avg.codeQualityScore?.toFixed(1) || 'N/A',
    totalCost: totalCost._sum.totalCost?.toString() || '0',
  });
}));
