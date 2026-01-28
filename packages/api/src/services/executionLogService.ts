import type { PrismaClient, Prisma } from '@prisma/client';

export interface CreateExecutionLogInput {
  taskId: string;
  agentId: string;
  step: number;
  thought?: string;
  action: string;
  actionInput: Prisma.InputJsonValue;
  observation: string;
  durationMs?: number;
  isLoop?: boolean;
  errorTrace?: string;
}

export class ExecutionLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new execution log entry
   */
  async createLog(input: CreateExecutionLogInput) {
    return await this.prisma.executionLog.create({
      data: {
        taskId: input.taskId,
        agentId: input.agentId,
        step: input.step,
        thought: input.thought,
        action: input.action,
        actionInput: input.actionInput,
        observation: input.observation,
        durationMs: input.durationMs,
        isLoop: input.isLoop || false,
        errorTrace: input.errorTrace,
      },
    });
  }

  /**
   * Get all execution logs for a task
   */
  async getTaskLogs(taskId: string) {
    return await this.prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { step: 'asc' },
      include: {
        agent: {
          include: {
            agentType: true,
          },
        },
      },
    });
  }

  /**
   * Get all execution logs for an agent
   */
  async getAgentLogs(agentId: string, limit: number = 100) {
    return await this.prisma.executionLog.findMany({
      where: { agentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        task: true,
      },
    });
  }

  /**
   * Get execution logs with loop detection
   */
  async getLoopLogs(taskId: string) {
    return await this.prisma.executionLog.findMany({
      where: {
        taskId,
        isLoop: true,
      },
      orderBy: { step: 'asc' },
    });
  }

  /**
   * Delete execution logs for a task (cleanup)
   */
  async deleteTaskLogs(taskId: string) {
    return await this.prisma.executionLog.deleteMany({
      where: { taskId },
    });
  }
}
