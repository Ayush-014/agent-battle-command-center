import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';

export const taskPlanningRouter: RouterType = Router();

/**
 * POST /api/task-planning/:taskId/decompose
 *
 * Triggers CTO agent to analyze and decompose a complex task into subtasks.
 * Returns immediately - the decomposition happens async.
 */
taskPlanningRouter.post('/:taskId/decompose', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  // Verify task exists and is pending
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { subTasks: true },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.subTasks && task.subTasks.length > 0) {
    res.status(400).json({
      error: 'Task already has subtasks',
      subtaskCount: task.subTasks.length
    });
    return;
  }

  // Find CTO agent
  const ctoAgent = await prisma.agent.findFirst({
    where: {
      agentType: { name: 'cto' },
      status: 'idle',
    },
    include: { agentType: true },
  });

  if (!ctoAgent) {
    res.status(503).json({ error: 'CTO agent is not available (busy or not found)' });
    return;
  }

  // Assign task to CTO for decomposition
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'assigned',
      assignedAgentId: ctoAgent.id,
      assignedAt: new Date(),
    },
  });

  await prisma.agent.update({
    where: { id: ctoAgent.id },
    data: {
      status: 'busy',
      currentTaskId: taskId,
    },
  });

  // Emit event
  const io = req.app.get('io') as SocketIOServer;
  io.emit('task_updated', {
    type: 'task_updated',
    payload: updatedTask,
    timestamp: new Date(),
  });

  // Prepare decomposition request
  const decompositionDescription = `
TASK DECOMPOSITION REQUEST

You have been assigned to decompose a complex task into smaller, focused subtasks.

PARENT TASK ID: ${task.id}
TITLE: ${task.title}
DESCRIPTION:
${task.description || 'No description provided'}

YOUR MISSION:
1. First, use file_list and code_search to understand the current codebase structure
2. Analyze this task and identify 2-5 discrete pieces of work
3. For EACH piece, use create_subtask() with:
   - Clear, specific title (imperative form)
   - Step-by-step description the local agent can follow
   - Measurable acceptance criteria
   - Context notes about relevant code patterns
   - Suggested agent type (coder or qa)
   - Priority (1-10)
4. After creating ALL subtasks, call complete_decomposition()

IMPORTANT:
- Each subtask should take a local agent <5 minutes to complete
- Be specific - vague instructions lead to failures
- Include file paths in descriptions
- Reference existing patterns from the codebase

Example subtask:
create_subtask(
  parent_task_id="${task.id}",
  title="Create add function in calculator.py",
  description="1. Create file tasks/calculator.py\\n2. Add function add(a, b) that returns a + b\\n3. Include docstring with usage example",
  acceptance_criteria="File exists, function takes 2 args, add(2,3)==5",
  context_notes="Other functions in codebase use type hints: def add(a: int, b: int) -> int",
  suggested_agent="coder",
  priority=5
)
`;

  res.json({
    success: true,
    message: 'Task decomposition started',
    taskId: task.id,
    assignedTo: ctoAgent.name,
    decompositionRequest: {
      task_id: task.id,
      agent_id: ctoAgent.id,
      task_description: decompositionDescription,
      expected_output: 'Task decomposed into subtasks',
      use_claude: true,
    },
  });
}));

/**
 * GET /api/task-planning/:taskId/subtasks
 *
 * Get all subtasks for a parent task.
 */
taskPlanningRouter.get('/:taskId/subtasks', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        include: {
          assignedAgent: {
            include: { agentType: true },
          },
        },
        orderBy: { priority: 'desc' },
      },
    },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.json({
    parentTask: {
      id: task.id,
      title: task.title,
      status: task.status,
    },
    subtasks: task.subTasks,
    subtaskCount: task.subTasks.length,
    completedCount: task.subTasks.filter(t => t.status === 'completed').length,
    pendingCount: task.subTasks.filter(t => t.status === 'pending').length,
  });
}));

/**
 * POST /api/task-planning/:taskId/execute-subtasks
 *
 * Execute all pending subtasks for a parent task, in priority order.
 */
taskPlanningRouter.post('/:taskId/execute-subtasks', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subTasks: {
        where: { status: 'pending' },
        orderBy: { priority: 'desc' },
      },
    },
  });

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.subTasks.length === 0) {
    res.status(400).json({ error: 'No pending subtasks to execute' });
    return;
  }

  res.json({
    success: true,
    message: `Ready to execute ${task.subTasks.length} subtasks`,
    subtasks: task.subTasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      requiredAgent: t.requiredAgent,
    })),
    hint: 'Use POST /api/queue/smart-assign to execute subtasks one by one',
  });
}));
