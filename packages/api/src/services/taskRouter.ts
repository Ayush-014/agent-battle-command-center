/**
 * Task Router Service - Cost-Optimized Tiered Routing
 *
 * NEW TIER SYSTEM:
 * ================
 * 1. DECOMPOSITION:
 *    - Complex (>=8) → Opus (strategic decomposition)
 *    - Standard (<8)  → Sonnet (cost-effective decomposition)
 *
 * 2. EXECUTION:
 *    - Simple (<4)   → Ollama (free, fast)
 *    - Medium+ (>=4) → Haiku (quality, cheap)
 *
 * 3. CODE REVIEW:
 *    - All completed → Opus batch review (highest quality)
 *
 * 4. FIX CYCLE:
 *    - 1st fix → Haiku
 *    - 2nd fix → Sonnet
 *    - 3rd fail → Human escalation
 *
 * COST ESTIMATES:
 * - Ollama: $0 (local)
 * - Haiku: ~$0.001/task
 * - Sonnet: ~$0.005/task
 * - Opus: ~$0.04/task
 */

import type { PrismaClient, Task, Agent } from '@prisma/client';
import { getDualComplexityAssessment } from './complexityAssessor.js';

// Model tiers for the routing system
export type ModelTier = 'ollama' | 'haiku' | 'sonnet' | 'opus';

export interface RoutingDecision {
  agentId: string;
  agentName: string;
  reason: string;
  confidence: number; // 0-1 score
  fallbackAgentId?: string; // Backup if first choice unavailable
  modelTier: ModelTier; // Which model tier to use
  estimatedCost: number; // Estimated cost in USD
  // Complexity assessment info
  complexity: number; // Final complexity used for routing
  routerComplexity?: number; // Rule-based complexity
  haikuComplexity?: number; // Haiku's assessment
  haikuReasoning?: string; // Haiku's explanation
  assessmentMethod?: 'dual' | 'router_only' | 'haiku_only';
}

export interface DecompositionDecision {
  modelTier: 'sonnet' | 'opus';
  reason: string;
}

export interface ReviewDecision {
  taskIds: string[];
  reviewerTier: 'opus';
  estimatedCost: number;
}

export interface FixDecision {
  modelTier: 'haiku' | 'sonnet';
  fixAttempt: number;
  escalateToHuman: boolean;
  reason: string;
}

export class TaskRouter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate task complexity score (1-10)
   *
   * Factors:
   * - Number of steps in description
   * - Keywords indicating complexity
   * - Task type
   * - Priority level
   */
  calculateComplexity(task: Task): number {
    let score = 0;

    const description = task.description || '';

    // Check for numbered steps
    const steps = description.match(/Step \d+:/gi)?.length || 0;
    score += steps * 0.5; // More steps = more complex

    // Check for complexity keywords
    const complexityKeywords = {
      high: ['multi-file', 'architecture', 'design', 'refactor', 'integrate', 'api', 'database'],
      medium: ['test', 'verify', 'validate', 'debug', 'fix', 'update'],
      low: ['create', 'add', 'simple', 'basic'],
    };

    complexityKeywords.high.forEach((keyword) => {
      if (description.toLowerCase().includes(keyword)) score += 2;
    });

    complexityKeywords.medium.forEach((keyword) => {
      if (description.toLowerCase().includes(keyword)) score += 1;
    });

    complexityKeywords.low.forEach((keyword) => {
      if (description.toLowerCase().includes(keyword)) score -= 0.5;
    });

    // Task type adds complexity
    if (task.taskType === 'code') score += 1;
    if (task.taskType === 'test') score += 1.5;
    if (task.taskType === 'review') score += 2;

    // Priority adds weight
    score += (task.priority / 10) * 0.5;

    // Check if task previously failed
    if (task.currentIteration > 0) {
      score += task.currentIteration * 1.5; // Failed tasks are more complex
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Determine best agent for a task
   */
  async routeTask(taskId: string): Promise<RoutingDecision> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get all available agents
    const agents = await this.prisma.agent.findMany({
      where: {
        status: 'idle',
      },
      include: {
        agentType: true,
      },
    });

    if (agents.length === 0) {
      // No idle agents - escalate to CTO for queue management
      const cto = await this.prisma.agent.findFirst({
        where: {
          agentType: {
            name: 'cto',
          },
        },
      });

      if (cto) {
        return {
          agentId: cto.id,
          agentName: cto.name,
          reason: 'All agents busy - CTO will manage queue and prioritize',
          confidence: 0.8,
          modelTier: 'opus' as ModelTier,
          estimatedCost: 0.04,
          complexity: 10, // High complexity if no agents available
          routerComplexity: 10,
          assessmentMethod: 'router_only' as const,
        };
      }

      throw new Error('No agents available');
    }

    // Calculate complexity using dual assessment (router + Haiku)
    const routerComplexity = this.calculateComplexity(task);
    let complexity = routerComplexity;
    let haikuComplexity: number | undefined;
    let haikuReasoning: string | undefined;
    let assessmentMethod: 'dual' | 'router_only' | 'haiku_only' = 'router_only';

    // Try dual assessment with Haiku (if API key available and task is not trivial)
    if (routerComplexity >= 2) {
      try {
        const dualAssessment = await getDualComplexityAssessment(
          task.title,
          task.description || '',
          routerComplexity
        );

        complexity = dualAssessment.finalComplexity;
        haikuComplexity = dualAssessment.haikuComplexity;
        haikuReasoning = dualAssessment.haikuReasoning;
        assessmentMethod = dualAssessment.assessmentMethod;

        // Save complexity assessments to task for future fine-tuning
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            routerComplexity,
            haikuComplexity,
            haikuReasoning,
            finalComplexity: complexity,
          },
        });

        console.log(`📊 Dual complexity: router=${routerComplexity}, haiku=${haikuComplexity}, final=${complexity}`);
      } catch (error) {
        console.warn('Dual assessment failed, using router complexity:', error);
        complexity = routerComplexity;
      }
    }

    // Route based on new tiered system
    let selectedAgent: Agent | null = null;
    let reason = '';
    let confidence = 0.5;
    let modelTier: ModelTier = 'ollama';
    let estimatedCost = 0;

    // Task explicitly requires specific agent (override all other rules)
    if (task.requiredAgent) {
      const requiredAgentName = task.requiredAgent.toLowerCase();
      selectedAgent = agents.find((a) => a.agentType.name === requiredAgentName) || null;
      if (selectedAgent) {
        reason = `Task explicitly requires ${task.requiredAgent} agent`;
        confidence = 1.0;
        modelTier = requiredAgentName === 'cto' ? 'opus' : requiredAgentName === 'qa' ? 'haiku' : 'ollama';
        estimatedCost = modelTier === 'opus' ? 0.04 : modelTier === 'haiku' ? 0.001 : 0;
      }
    }

    // NEW TIER SYSTEM ROUTING
    // ========================

    // SIMPLE TASKS (<4 complexity) → Ollama (Coder - free)
    if (!selectedAgent && complexity < 4) {
      selectedAgent = agents.find((a) => a.agentType.name === 'coder') || null;
      if (selectedAgent) {
        reason = `Simple task (${complexity.toFixed(1)}/10) → Ollama (free, fast)`;
        confidence = 0.85;
        modelTier = 'ollama';
        estimatedCost = 0;
      }
    }

    // MEDIUM+ TASKS (>=4 complexity) → Haiku (QA - quality, cheap)
    if (!selectedAgent && complexity >= 4) {
      selectedAgent = agents.find((a) => a.agentType.name === 'qa') || null;
      if (selectedAgent) {
        reason = `Medium+ task (${complexity.toFixed(1)}/10) → Haiku (quality, ~$0.001)`;
        confidence = 0.9;
        modelTier = 'haiku';
        estimatedCost = 0.001;
      } else {
        // QA not available - use coder but WITH HAIKU tier for quality
        // This ensures medium+ tasks still get Claude Haiku even when routed to coder agent
        selectedAgent = agents.find((a) => a.agentType.name === 'coder') || null;
        if (selectedAgent) {
          reason = `Medium+ task (${complexity.toFixed(1)}/10) → Coder w/ Haiku (QA busy, using quality model)`;
          confidence = 0.75;
          modelTier = 'haiku'; // Keep haiku tier for quality
          estimatedCost = 0.001;
        }
      }
    }

    // FAILED TASKS - Use fix cycle logic
    if (!selectedAgent && task.currentIteration > 0) {
      const fixDecision = this.getFixDecision(task.currentIteration);

      if (fixDecision.escalateToHuman) {
        // Mark for human intervention
        reason = `${task.currentIteration} failures → Escalate to human`;
        confidence = 1.0;
        modelTier = 'opus'; // Will flag for human
        estimatedCost = 0;
      } else {
        // Route to appropriate fix tier
        const fixAgentType = fixDecision.modelTier === 'sonnet' ? 'cto' : 'qa';
        selectedAgent = agents.find((a) => a.agentType.name === fixAgentType) || null;
        if (selectedAgent) {
          reason = fixDecision.reason;
          confidence = 0.85;
          modelTier = fixDecision.modelTier;
          estimatedCost = fixDecision.modelTier === 'sonnet' ? 0.005 : 0.001;
        }
      }
    }

    // Fallback: First available agent (preserve appropriate model tier based on complexity)
    if (!selectedAgent) {
      selectedAgent = agents[0];
      // Determine appropriate model tier based on task complexity
      if (complexity >= 4) {
        reason = `Fallback assignment (complexity ${complexity.toFixed(1)}/10) → using Haiku for quality`;
        modelTier = 'haiku';
        estimatedCost = 0.001;
      } else {
        reason = `Fallback assignment (complexity ${complexity.toFixed(1)}/10) → using Ollama`;
        modelTier = 'ollama';
        estimatedCost = 0;
      }
      confidence = 0.5;
    }

    // Find fallback agent (prefer QA as backup for coder tasks)
    const fallbackAgent = modelTier === 'ollama'
      ? agents.find((a) => a.agentType.name === 'qa')
      : agents.find((a) => a.id !== selectedAgent!.id);

    return {
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      reason,
      confidence,
      fallbackAgentId: fallbackAgent?.id,
      modelTier,
      estimatedCost,
      // Complexity assessment info
      complexity,
      routerComplexity,
      haikuComplexity,
      haikuReasoning,
      assessmentMethod,
    };
  }

  /**
   * Determine which model to use for task decomposition
   */
  getDecompositionDecision(complexity: number): DecompositionDecision {
    if (complexity >= 8) {
      return {
        modelTier: 'opus',
        reason: `High complexity (${complexity.toFixed(1)}/10) requires Opus for strategic decomposition`,
      };
    }
    return {
      modelTier: 'sonnet',
      reason: `Standard complexity (${complexity.toFixed(1)}/10) - Sonnet provides cost-effective decomposition`,
    };
  }

  /**
   * Determine fix strategy based on failure count
   */
  getFixDecision(failureCount: number): FixDecision {
    if (failureCount === 1) {
      return {
        modelTier: 'haiku',
        fixAttempt: 1,
        escalateToHuman: false,
        reason: '1st failure → Haiku fix attempt (~$0.001)',
      };
    }
    if (failureCount === 2) {
      return {
        modelTier: 'sonnet',
        fixAttempt: 2,
        escalateToHuman: false,
        reason: '2nd failure → Sonnet fix attempt (~$0.005)',
      };
    }
    return {
      modelTier: 'sonnet',
      fixAttempt: failureCount,
      escalateToHuman: true,
      reason: `${failureCount} failures → Escalate to human`,
    };
  }

  /**
   * Batch review decision for completed tasks
   */
  async getReviewDecision(taskIds: string[]): Promise<ReviewDecision> {
    // Always use Opus for code review (highest quality matters most here)
    return {
      taskIds,
      reviewerTier: 'opus',
      estimatedCost: taskIds.length * 0.02, // ~$0.02 per task review
    };
  }

  /**
   * Auto-assign the next pending task
   */
  async autoAssignNext(): Promise<{ task: Task; decision: RoutingDecision } | null> {
    // Get highest priority pending task
    const task = await this.prisma.task.findFirst({
      where: {
        status: 'pending',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!task) {
      return null; // No pending tasks
    }

    // Route the task
    const decision = await this.routeTask(task.id);

    // Assign the task
    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'assigned',
        assignedAgentId: decision.agentId,
        assignedAt: new Date(),
      },
    });

    // Update agent status
    await this.prisma.agent.update({
      where: { id: decision.agentId },
      data: {
        status: 'busy',
        currentTaskId: task.id,
      },
    });

    return {
      task: updatedTask,
      decision,
    };
  }
}
