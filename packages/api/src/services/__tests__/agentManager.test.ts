import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentManagerService } from '../agentManager.js';
import { prisma } from '../../db/client.js';

// Mock Prisma
vi.mock('../../db/client.js', () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agentType: {
      findUnique: vi.fn(),
    },
  },
}));

describe('AgentManagerService', () => {
  let agentManager: AgentManagerService;
  let mockIO: any;

  beforeEach(() => {
    mockIO = {
      emit: vi.fn(),
    };
    agentManager = new AgentManagerService(prisma, mockIO);
    vi.clearAllMocks();
  });

  describe('getAgents', () => {
    it('should return all agents', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Coder-01',
          status: 'idle',
          agentTypeId: 'type-1',
          agentType: { id: 'type-1', name: 'coder' },
          config: {},
          stats: {},
          currentTaskId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.agent.findMany).mockResolvedValue(mockAgents as any);

      const agents = await agentManager.getAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('agent-1');
    });
  });

  describe('getAgent', () => {
    it('should return single agent by ID', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Coder-01',
        status: 'idle',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: {},
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.getAgent('agent-1');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('agent-1');
    });

    it('should return null for non-existent agent', async () => {
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

      const agent = await agentManager.getAgent('non-existent');

      expect(agent).toBeNull();
    });
  });

  describe('updateAgentConfig', () => {
    it('should update agent configuration', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Coder-01',
        status: 'idle',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: { preferredModel: 'new-model' },
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.updateAgentConfig('agent-1', {
        preferredModel: 'new-model',
      });

      expect(agent?.config).toEqual({ preferredModel: 'new-model' });
      expect(mockIO.emit).toHaveBeenCalledWith('agent_status_changed', expect.anything());
    });
  });

  describe('setAgentOffline', () => {
    it('should set agent to offline status', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Coder-01',
        status: 'offline',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: {},
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.setAgentOffline('agent-1');

      expect(agent?.status).toBe('offline');
      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agent-1' },
          data: { status: 'offline' },
        })
      );
    });
  });

  describe('setAgentOnline', () => {
    it('should set agent to idle status', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Coder-01',
        status: 'idle',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: {},
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.setAgentOnline('agent-1');

      expect(agent?.status).toBe('idle');
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent when idle', async () => {
      const mockAgent = {
        id: 'agent-1',
        status: 'idle',
      };

      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);
      vi.mocked(prisma.agent.delete).mockResolvedValue({} as any);

      const result = await agentManager.deleteAgent('agent-1');

      expect(result).toBe(true);
      expect(mockIO.emit).toHaveBeenCalledWith('agent_deleted', expect.anything());
    });

    it('should reject deletion when agent is busy', async () => {
      const mockAgent = {
        id: 'agent-1',
        status: 'busy',
      };

      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

      await expect(agentManager.deleteAgent('agent-1')).rejects.toThrow(
        'Cannot delete agent while busy'
      );
    });

    it('should return false for non-existent agent', async () => {
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

      const result = await agentManager.deleteAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('pauseAgent', () => {
    it('should set agent to paused status', async () => {
      const mockAgent = {
        id: 'agent-1',
        status: 'paused',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: {},
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.pauseAgent('agent-1');

      expect(agent?.status).toBe('paused');
    });
  });

  describe('resumeAgent', () => {
    it('should set paused agent to idle', async () => {
      const mockAgent = {
        id: 'agent-1',
        status: 'idle',
        agentTypeId: 'type-1',
        agentType: { id: 'type-1', name: 'coder' },
        config: {},
        stats: {},
        currentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);

      const agent = await agentManager.resumeAgent('agent-1');

      expect(agent?.status).toBe('idle');
    });
  });
});
