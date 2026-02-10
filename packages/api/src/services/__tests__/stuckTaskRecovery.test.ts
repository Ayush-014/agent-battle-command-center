import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { StuckTaskRecoveryService } from '../stuckTaskRecovery.js';
import { prisma } from '../../db/client.js';

// Mock Prisma
jest.mock('../../db/client.js', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    agent: {
      update: jest.fn(),
    },
    taskExecution: {
      update: jest.fn(),
    },
    fileLock: {
      deleteMany: jest.fn(),
    },
  },
}));

describe('StuckTaskRecoveryService', () => {
  let recoveryService: StuckTaskRecoveryService;
  let mockIO: any;

  beforeEach(() => {
    mockIO = {
      emit: jest.fn(),
    };

    recoveryService = new StuckTaskRecoveryService(mockIO);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    recoveryService.stop();
  });

  describe('findStuckTasks', () => {
    it('should identify tasks stuck longer than timeout', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const mockStuckTask = {
        id: 'stuck-task-1',
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        updatedAt: oneHourAgo,
      };

      jest.mocked(prisma.task.findMany).mockResolvedValue([mockStuckTask] as any);

      const stuckTasks = await (recoveryService as any).findStuckTasks();

      expect(stuckTasks).toHaveLength(1);
      expect(stuckTasks[0].id).toBe('stuck-task-1');
    });

    it('should not flag recently updated tasks', async () => {
      const justNow = new Date(Date.now() - 5000); // 5 seconds ago
      const mockRecentTask = {
        id: 'recent-task',
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        updatedAt: justNow,
      };

      jest.mocked(prisma.task.findMany).mockResolvedValue([mockRecentTask] as any);

      const stuckTasks = await (recoveryService as any).findStuckTasks();

      expect(stuckTasks).toHaveLength(0);
    });

    it('should include both in_progress and assigned tasks', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      jest.mocked(prisma.task.findMany).mockResolvedValue([
        { id: 'task-1', status: 'in_progress', assignedAgentId: 'agent-1', updatedAt: oneHourAgo },
        { id: 'task-2', status: 'assigned', assignedAgentId: 'agent-2', updatedAt: oneHourAgo },
      ] as any);

      const stuckTasks = await (recoveryService as any).findStuckTasks();

      expect(stuckTasks).toHaveLength(2);
    });
  });

  describe('recoverStuckTask', () => {
    it('should mark task as aborted and release agent', async () => {
      const mockTask = {
        id: 'stuck-task-1',
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      jest.mocked(prisma.task.update).mockResolvedValue({ ...mockTask, status: 'aborted' } as any);
      jest.mocked(prisma.agent.update).mockResolvedValue({ id: 'agent-1', status: 'idle' } as any);
      jest.mocked(prisma.taskExecution.update).mockResolvedValue({} as any);
      jest.mocked(prisma.fileLock.deleteMany).mockResolvedValue({ count: 0 } as any);

      await (recoveryService as any).recoverStuckTask(mockTask);

      // Task should be aborted
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stuck-task-1' },
          data: expect.objectContaining({
            status: 'aborted',
            errorCategory: 'timeout',
          }),
        })
      );

      // Agent should be freed
      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agent-1' },
          data: expect.objectContaining({
            status: 'idle',
            currentTaskId: null,
          }),
        })
      );

      // File locks should be released
      expect(prisma.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { taskId: 'stuck-task-1' },
      });
    });

    it('should emit WebSocket events for UI updates', async () => {
      const mockTask = {
        id: 'stuck-task-1',
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      jest.mocked(prisma.task.update).mockResolvedValue({ ...mockTask, status: 'aborted' } as any);
      jest.mocked(prisma.agent.update).mockResolvedValue({ id: 'agent-1', status: 'idle' } as any);
      jest.mocked(prisma.taskExecution.update).mockResolvedValue({} as any);
      jest.mocked(prisma.fileLock.deleteMany).mockResolvedValue({ count: 0 } as any);

      await (recoveryService as any).recoverStuckTask(mockTask);

      expect(mockIO.emit).toHaveBeenCalledWith('task_updated', expect.anything());
      expect(mockIO.emit).toHaveBeenCalledWith('agent_status_changed', expect.anything());
      expect(mockIO.emit).toHaveBeenCalledWith('alert', expect.objectContaining({
        payload: expect.objectContaining({
          type: 'task_timeout',
        }),
      }));
    });

    it('should update agent stats (increment tasksFailed)', async () => {
      const mockTask = {
        id: 'stuck-task-1',
        status: 'in_progress',
        assignedAgentId: 'agent-1',
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      const mockAgent = {
        id: 'agent-1',
        status: 'busy',
        stats: { tasksCompleted: 5, tasksFailed: 2, successRate: 0.71 },
      };

      jest.mocked(prisma.agent.update).mockResolvedValue(mockAgent as any);
      jest.mocked(prisma.task.update).mockResolvedValue({ ...mockTask, status: 'aborted' } as any);
      jest.mocked(prisma.taskExecution.update).mockResolvedValue({} as any);
      jest.mocked(prisma.fileLock.deleteMany).mockResolvedValue({ count: 0 } as any);

      await (recoveryService as any).recoverStuckTask(mockTask);

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stats: expect.objectContaining({
              tasksFailed: 3, // Was 2, should increment to 3
            }),
          }),
        })
      );
    });
  });

  describe('triggerCheck', () => {
    it('should recover all stuck tasks', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      jest.mocked(prisma.task.findMany).mockResolvedValue([
        { id: 'stuck-1', status: 'in_progress', assignedAgentId: 'agent-1', updatedAt: oneHourAgo },
        { id: 'stuck-2', status: 'in_progress', assignedAgentId: 'agent-2', updatedAt: oneHourAgo },
      ] as any);

      jest.mocked(prisma.task.update).mockResolvedValue({} as any);
      jest.mocked(prisma.agent.update).mockResolvedValue({} as any);
      jest.mocked(prisma.taskExecution.update).mockResolvedValue({} as any);
      jest.mocked(prisma.fileLock.deleteMany).mockResolvedValue({ count: 0 } as any);

      const results = await recoveryService.triggerCheck();

      expect(results).toHaveLength(2);
      expect(results[0].taskId).toBe('stuck-1');
      expect(results[1].taskId).toBe('stuck-2');
    });

    it('should return empty array when no stuck tasks', async () => {
      jest.mocked(prisma.task.findMany).mockResolvedValue([]);

      const results = await recoveryService.triggerCheck();

      expect(results).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('should return service configuration', () => {
      const status = recoveryService.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.running).toBe(false); // Not started in tests
      expect(status.taskTimeoutMs).toBe(600000); // 10 minutes default
      expect(status.checkIntervalMs).toBe(60000); // 1 minute default
      expect(status.recentRecoveries).toEqual([]);
    });

    it('should track recent recoveries', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      jest.mocked(prisma.task.findMany).mockResolvedValue([
        { id: 'stuck-1', status: 'in_progress', assignedAgentId: 'agent-1', updatedAt: oneHourAgo },
      ] as any);

      jest.mocked(prisma.task.update).mockResolvedValue({} as any);
      jest.mocked(prisma.agent.update).mockResolvedValue({} as any);
      jest.mocked(prisma.taskExecution.update).mockResolvedValue({} as any);
      jest.mocked(prisma.fileLock.deleteMany).mockResolvedValue({ count: 0 } as any);

      await recoveryService.triggerCheck();

      const status = recoveryService.getStatus();
      expect(status.recentRecoveries).toHaveLength(1);
      expect(status.recentRecoveries[0].taskId).toBe('stuck-1');
    });
  });

  describe('updateConfig', () => {
    it('should update timeout value', () => {
      recoveryService.updateConfig({ taskTimeoutMs: 300000 }); // 5 minutes

      const config = recoveryService.getConfig();
      expect(config.taskTimeoutMs).toBe(300000);
    });

    it('should update check interval', () => {
      recoveryService.updateConfig({ checkIntervalMs: 30000 }); // 30 seconds

      const config = recoveryService.getConfig();
      expect(config.checkIntervalMs).toBe(30000);
    });

    it('should enable/disable service', () => {
      recoveryService.updateConfig({ enabled: false });

      const config = recoveryService.getConfig();
      expect(config.enabled).toBe(false);
    });
  });
});
