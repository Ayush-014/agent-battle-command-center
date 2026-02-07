import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { Agent, AgentType, AgentStatus, AgentConfig } from '../types/index.js';

export class AgentManagerService {
  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {}

  async getAgents(): Promise<Agent[]> {
    const agents = await this.prisma.agent.findMany({
      include: { agentType: true },
      orderBy: { name: 'asc' },
    });

    return agents.map(this.formatAgent);
  }

  async getAgent(id: string): Promise<Agent | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: { agentType: true },
    });

    return agent ? this.formatAgent(agent) : null;
  }

  async getAgentsByType(type: AgentType): Promise<Agent[]> {
    const agentType = await this.prisma.agentType.findUnique({
      where: { name: type },
    });

    if (!agentType) return [];

    const agents = await this.prisma.agent.findMany({
      where: { agentTypeId: agentType.id },
      include: { agentType: true },
    });

    return agents.map(this.formatAgent);
  }

  async getIdleAgents(): Promise<Agent[]> {
    const agents = await this.prisma.agent.findMany({
      where: { status: 'idle' },
      include: { agentType: true },
    });

    return agents.map(this.formatAgent);
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<Agent | null> {
    const updated = await this.prisma.agent.update({
      where: { id },
      data: { status },
      include: { agentType: true },
    });

    const agent = this.formatAgent(updated);
    this.emitAgentUpdate(agent);

    return agent;
  }

  async updateAgentConfig(id: string, config: Partial<AgentConfig>): Promise<Agent | null> {
    const current = await this.prisma.agent.findUnique({ where: { id } });
    if (!current) return null;

    const currentConfig = current.config as AgentConfig;
    const newConfig = { ...currentConfig, ...config };

    const updated = await this.prisma.agent.update({
      where: { id },
      data: { config: newConfig },
      include: { agentType: true },
    });

    return this.formatAgent(updated);
  }

  async pauseAgent(id: string): Promise<Agent | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) return null;

    // Only pause if busy
    if (agent.status !== 'busy') {
      return this.formatAgent({ ...agent, agentType: { name: '' } } as Parameters<typeof this.formatAgent>[0]);
    }

    const updated = await this.prisma.agent.update({
      where: { id },
      data: { status: 'stuck' }, // Using stuck as "paused"
      include: { agentType: true },
    });

    const formattedAgent = this.formatAgent(updated);
    this.emitAgentUpdate(formattedAgent);

    this.io.emit('alert', {
      type: 'agent_stuck',
      severity: 'info',
      title: 'Agent Paused',
      message: `Agent ${updated.name} has been paused`,
      agentId: id,
      createdAt: new Date(),
    });

    return formattedAgent;
  }

  async resumeAgent(id: string): Promise<Agent | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) return null;

    // Determine new status based on whether agent has a task
    const newStatus = agent.currentTaskId ? 'busy' : 'idle';

    const updated = await this.prisma.agent.update({
      where: { id },
      data: { status: newStatus },
      include: { agentType: true },
    });

    const formattedAgent = this.formatAgent(updated);
    this.emitAgentUpdate(formattedAgent);

    return formattedAgent;
  }

  async setAgentOffline(id: string): Promise<Agent | null> {
    // Release any file locks
    await this.prisma.fileLock.deleteMany({
      where: { lockedByAgent: id },
    });

    // If agent has a task, return it to pool
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (agent?.currentTaskId) {
      await this.prisma.task.update({
        where: { id: agent.currentTaskId },
        data: {
          status: 'pending',
          assignedAgentId: null,
          assignedAt: null,
        },
      });
    }

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        status: 'offline',
        currentTaskId: null,
      },
      include: { agentType: true },
    });

    const formattedAgent = this.formatAgent(updated);
    this.emitAgentUpdate(formattedAgent);

    return formattedAgent;
  }

  async setAgentOnline(id: string): Promise<Agent | null> {
    const updated = await this.prisma.agent.update({
      where: { id },
      data: { status: 'idle' },
      include: { agentType: true },
    });

    const formattedAgent = this.formatAgent(updated);
    this.emitAgentUpdate(formattedAgent);

    return formattedAgent;
  }

  async getAgentStats(id: string): Promise<Agent['stats'] | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    return agent ? (agent.stats as unknown as Agent['stats']) : null;
  }

  private formatAgent(agent: {
    id: string;
    agentTypeId: string;
    name: string;
    status: string;
    currentTaskId: string | null;
    config: unknown;
    stats: unknown;
    createdAt: Date;
    updatedAt: Date;
    agentType: { name: string };
  }): Agent {
    return {
      id: agent.id,
      agentTypeId: agent.agentTypeId,
      type: agent.agentType.name as AgentType,
      name: agent.name,
      status: agent.status as AgentStatus,
      currentTaskId: agent.currentTaskId,
      config: agent.config as Agent['config'],
      stats: agent.stats as Agent['stats'],
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  async deleteAgent(id: string): Promise<boolean> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      return false;
    }

    // Can't delete if agent is busy
    if (agent.status === 'busy') {
      throw new Error('Cannot delete agent while busy. Abort current task first.');
    }

    await this.prisma.agent.delete({ where: { id } });

    // Emit deletion event
    this.io.emit('agent_deleted', {
      type: 'agent_deleted',
      payload: { id },
      timestamp: new Date(),
    });

    return true;
  }

  private emitAgentUpdate(agent: Agent): void {
    this.io.emit('agent_status_changed', {
      type: 'agent_status_changed',
      payload: agent,
      timestamp: new Date(),
    });
  }
}
