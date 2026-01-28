import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskRouter } from '../taskRouter.js';
import { prismaMock } from '../../__mocks__/prisma.js';
import type { Task, Agent, AgentType as PrismaAgentType } from '@prisma/client';

describe('TaskRouter', () => {
  let router: TaskRouter;

  beforeEach(() => {
    router = new TaskRouter(prismaMock);
  });

  describe('calculateComplexity', () => {
    const createTask = (overrides: Partial<Task> = {}): Task => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      taskType: 'code',
      status: 'pending',
      priority: 5,
      parentTaskId: null,
      assignedAgentId: null,
      requiredAgent: null,
      lockedFiles: [],
      result: null,
      error: null,
      currentIteration: 0,
      maxIterations: 3,
      assignedAt: null,
      completedAt: null,
      needsHumanAt: null,
      humanTimeoutMinutes: 30,
      escalatedToAgentId: null,
      apiCreditsUsed: 0 as unknown as import('@prisma/client/runtime/library').Decimal,
      timeSpentMs: 0,
      acceptanceCriteria: null,
      contextNotes: null,
      validationCommand: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return low complexity for simple tasks', () => {
      const task = createTask({
        description: 'Create a simple function to add two numbers',
      });

      const complexity = router.calculateComplexity(task);

      // 'create' and 'simple' keywords reduce score (-0.5 each)
      // 'code' taskType adds +1
      // priority 5/10 adds +0.25
      expect(complexity).toBeLessThan(4);
    });

    it('should return high complexity for architecture tasks', () => {
      const task = createTask({
        description: 'Refactor the architecture to integrate with the new API and database',
      });

      const complexity = router.calculateComplexity(task);

      // 'refactor' (+2), 'architecture' (+2), 'integrate' (+2), 'api' (+2), 'database' (+2)
      // = 10 from keywords alone
      expect(complexity).toBeGreaterThanOrEqual(6);
    });

    it('should add complexity for numbered steps', () => {
      const taskWithSteps = createTask({
        description: 'Step 1: Create file. Step 2: Add function. Step 3: Test it.',
      });
      const taskWithoutSteps = createTask({
        description: 'Create file, add function, test it.',
      });

      const complexityWithSteps = router.calculateComplexity(taskWithSteps);
      const complexityWithoutSteps = router.calculateComplexity(taskWithoutSteps);

      // 3 steps should add 1.5 complexity (0.5 per step)
      expect(complexityWithSteps).toBeGreaterThan(complexityWithoutSteps);
    });

    it('should add complexity for failed tasks (iteration > 0)', () => {
      const freshTask = createTask({ currentIteration: 0 });
      const failedOnceTask = createTask({ currentIteration: 1 });
      const failedTwiceTask = createTask({ currentIteration: 2 });

      const freshComplexity = router.calculateComplexity(freshTask);
      const failedOnceComplexity = router.calculateComplexity(failedOnceTask);
      const failedTwiceComplexity = router.calculateComplexity(failedTwiceTask);

      // Each iteration adds +1.5
      expect(failedOnceComplexity - freshComplexity).toBeCloseTo(1.5);
      expect(failedTwiceComplexity - freshComplexity).toBeCloseTo(3.0);
    });

    it('should add complexity based on task type', () => {
      const codeTask = createTask({ taskType: 'code', description: '' });
      const testTask = createTask({ taskType: 'test', description: '' });
      const reviewTask = createTask({ taskType: 'review', description: '' });

      const codeComplexity = router.calculateComplexity(codeTask);
      const testComplexity = router.calculateComplexity(testTask);
      const reviewComplexity = router.calculateComplexity(reviewTask);

      // code +1, test +1.5, review +2
      expect(testComplexity).toBeGreaterThan(codeComplexity);
      expect(reviewComplexity).toBeGreaterThan(testComplexity);
    });

    it('should clamp complexity between 1 and 10', () => {
      const verySimpleTask = createTask({
        description: 'simple basic create add simple basic',
        taskType: 'code',
        priority: 0,
      });
      const veryComplexTask = createTask({
        description: 'refactor architecture design integrate api database multi-file debug fix update test verify validate',
        taskType: 'review',
        priority: 10,
        currentIteration: 3,
      });

      const simpleComplexity = router.calculateComplexity(verySimpleTask);
      const complexComplexity = router.calculateComplexity(veryComplexTask);

      expect(simpleComplexity).toBeGreaterThanOrEqual(1);
      expect(complexComplexity).toBeLessThanOrEqual(10);
    });
  });

  describe('getDecompositionDecision', () => {
    it('should return opus for complexity >= 8', () => {
      const decision = router.getDecompositionDecision(8);

      expect(decision.modelTier).toBe('opus');
      expect(decision.reason).toContain('High complexity');
    });

    it('should return opus for complexity > 8', () => {
      const decision = router.getDecompositionDecision(9.5);

      expect(decision.modelTier).toBe('opus');
    });

    it('should return sonnet for complexity < 8', () => {
      const decision = router.getDecompositionDecision(7.9);

      expect(decision.modelTier).toBe('sonnet');
      expect(decision.reason).toContain('Standard complexity');
      expect(decision.reason).toContain('cost-effective');
    });

    it('should return sonnet for low complexity', () => {
      const decision = router.getDecompositionDecision(2);

      expect(decision.modelTier).toBe('sonnet');
    });
  });

  describe('getFixDecision', () => {
    it('should return haiku for 1st failure', () => {
      const decision = router.getFixDecision(1);

      expect(decision.modelTier).toBe('haiku');
      expect(decision.fixAttempt).toBe(1);
      expect(decision.escalateToHuman).toBe(false);
      expect(decision.reason).toContain('1st failure');
    });

    it('should return sonnet for 2nd failure', () => {
      const decision = router.getFixDecision(2);

      expect(decision.modelTier).toBe('sonnet');
      expect(decision.fixAttempt).toBe(2);
      expect(decision.escalateToHuman).toBe(false);
      expect(decision.reason).toContain('2nd failure');
    });

    it('should escalate to human for 3rd failure', () => {
      const decision = router.getFixDecision(3);

      expect(decision.escalateToHuman).toBe(true);
      expect(decision.fixAttempt).toBe(3);
      expect(decision.reason).toContain('Escalate to human');
    });

    it('should escalate to human for failures > 3', () => {
      const decision = router.getFixDecision(5);

      expect(decision.escalateToHuman).toBe(true);
      expect(decision.fixAttempt).toBe(5);
    });
  });

  describe('getReviewDecision', () => {
    it('should return opus as reviewer for all tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      const decision = await router.getReviewDecision(taskIds);

      expect(decision.reviewerTier).toBe('opus');
      expect(decision.taskIds).toEqual(taskIds);
    });

    it('should estimate cost at $0.02 per task', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];

      const decision = await router.getReviewDecision(taskIds);

      expect(decision.estimatedCost).toBe(0.1); // 5 tasks * $0.02
    });
  });

  describe('routeTask', () => {
    const createMockAgent = (
      id: string,
      typeName: string,
      status: string = 'idle'
    ): Agent & { agentType: PrismaAgentType } => ({
      id,
      agentTypeId: `type-${typeName}`,
      name: `${typeName}-agent`,
      status,
      currentTaskId: null,
      config: {},
      stats: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      agentType: {
        id: `type-${typeName}`,
        name: typeName,
        displayName: typeName,
        description: null,
        capabilities: [],
        icon: null,
        color: null,
        createdAt: new Date(),
      },
    });

    const createTask = (overrides: Partial<Task> = {}): Task => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      taskType: 'code',
      status: 'pending',
      priority: 5,
      parentTaskId: null,
      assignedAgentId: null,
      requiredAgent: null,
      lockedFiles: [],
      result: null,
      error: null,
      currentIteration: 0,
      maxIterations: 3,
      assignedAt: null,
      completedAt: null,
      needsHumanAt: null,
      humanTimeoutMinutes: 30,
      escalatedToAgentId: null,
      apiCreditsUsed: 0 as unknown as import('@prisma/client/runtime/library').Decimal,
      timeSpentMs: 0,
      acceptanceCriteria: null,
      contextNotes: null,
      validationCommand: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should throw if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(router.routeTask('nonexistent')).rejects.toThrow('Task nonexistent not found');
    });

    it('should throw if no agents available', async () => {
      const task = createTask();
      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([]);
      prismaMock.agent.findFirst.mockResolvedValue(null);

      await expect(router.routeTask('task-1')).rejects.toThrow('No agents available');
    });

    it('should route simple tasks (< 4) to coder/ollama', async () => {
      const task = createTask({ description: 'Create a simple function' });
      const coderAgent = createMockAgent('coder-1', 'coder');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([coderAgent]);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('coder-1');
      expect(decision.modelTier).toBe('ollama');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should route medium+ tasks (>= 4) to qa/haiku', async () => {
      const task = createTask({
        description: 'Refactor the API integration to fix bugs',
      });
      const qaAgent = createMockAgent('qa-1', 'qa');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([qaAgent]);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('qa-1');
      expect(decision.modelTier).toBe('haiku');
      expect(decision.estimatedCost).toBe(0.001);
    });

    it('should respect requiredAgent override', async () => {
      const task = createTask({
        description: 'Simple task',
        requiredAgent: 'cto',
      });
      const ctoAgent = createMockAgent('cto-1', 'cto');
      const coderAgent = createMockAgent('coder-1', 'coder');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([ctoAgent, coderAgent]);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('cto-1');
      expect(decision.confidence).toBe(1.0);
      expect(decision.reason).toContain('explicitly requires');
    });

    it('should fall back to CTO when all agents busy', async () => {
      const task = createTask();
      const ctoAgent = createMockAgent('cto-1', 'cto', 'busy');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([]); // No idle agents
      prismaMock.agent.findFirst.mockResolvedValue(ctoAgent);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('cto-1');
      expect(decision.reason).toContain('All agents busy');
    });
  });
});
