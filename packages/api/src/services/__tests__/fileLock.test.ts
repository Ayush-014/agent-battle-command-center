import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { FileLockService } from '../fileLock.js';
import { prismaMock } from '../../__mocks__/prisma.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { FileLock } from '@prisma/client';

// Mock socket.io
const mockIo = {
  emit: jest.fn(),
} as unknown as SocketIOServer;

describe('FileLockService', () => {
  let service: FileLockService;

  beforeEach(() => {
    service = new FileLockService(prismaMock, mockIo);
    jest.clearAllMocks();
  });

  const createFileLock = (overrides: Partial<FileLock> = {}): FileLock => ({
    id: 'lock-1',
    filePath: 'src/index.ts',
    lockedByAgent: 'agent-1',
    lockedByTask: 'task-1',
    lockedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    ...overrides,
  });

  describe('acquireLock', () => {
    it('should create new lock when file is not locked', async () => {
      const newLock = createFileLock();

      prismaMock.fileLock.findUnique.mockResolvedValue(null);
      prismaMock.fileLock.create.mockResolvedValue(newLock);

      const result = await service.acquireLock('src/index.ts', 'agent-1', 'task-1');

      expect(result).toBeTruthy();
      expect(prismaMock.fileLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filePath: 'src/index.ts',
          lockedByAgent: 'agent-1',
          lockedByTask: 'task-1',
        }),
      });
    });

    it('should reject lock when file is locked by another agent', async () => {
      const existingLock = createFileLock({
        lockedByAgent: 'other-agent',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Not expired
      });

      prismaMock.fileLock.findUnique.mockResolvedValue(existingLock);

      const result = await service.acquireLock('src/index.ts', 'agent-1', 'task-1');

      expect(result).toBeNull();
      expect(mockIo.emit).toHaveBeenCalledWith('alert', expect.objectContaining({
        type: 'file_conflict',
        severity: 'warning',
      }));
    });

    it('should acquire expired lock', async () => {
      const expiredLock = createFileLock({
        lockedByAgent: 'other-agent',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      const updatedLock = createFileLock();

      prismaMock.fileLock.findUnique.mockResolvedValue(expiredLock);
      prismaMock.fileLock.update.mockResolvedValue(updatedLock);

      const result = await service.acquireLock('src/index.ts', 'agent-1', 'task-1');

      expect(result).toBeTruthy();
      expect(prismaMock.fileLock.update).toHaveBeenCalledWith({
        where: { filePath: 'src/index.ts' },
        data: expect.objectContaining({
          lockedByAgent: 'agent-1',
          lockedByTask: 'task-1',
        }),
      });
    });

    it('should extend lock when same agent requests it', async () => {
      const existingLock = createFileLock({
        lockedByAgent: 'agent-1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes remaining
      });
      const extendedLock = createFileLock({
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Extended
      });

      prismaMock.fileLock.findUnique.mockResolvedValue(existingLock);
      prismaMock.fileLock.update.mockResolvedValue(extendedLock);

      const result = await service.acquireLock('src/index.ts', 'agent-1', 'task-1');

      expect(result).toBeTruthy();
      expect(prismaMock.fileLock.update).toHaveBeenCalledWith({
        where: { filePath: 'src/index.ts' },
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should use custom duration when specified', async () => {
      const newLock = createFileLock();

      prismaMock.fileLock.findUnique.mockResolvedValue(null);
      prismaMock.fileLock.create.mockResolvedValue(newLock);

      await service.acquireLock('src/index.ts', 'agent-1', 'task-1', 60); // 60 minutes

      expect(prismaMock.fileLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('releaseLock', () => {
    it('should release lock owned by agent', async () => {
      const lock = createFileLock({ lockedByAgent: 'agent-1' });

      prismaMock.fileLock.findUnique.mockResolvedValue(lock);
      prismaMock.fileLock.delete.mockResolvedValue(lock);

      const result = await service.releaseLock('src/index.ts', 'agent-1');

      expect(result).toBe(true);
      expect(prismaMock.fileLock.delete).toHaveBeenCalledWith({
        where: { filePath: 'src/index.ts' },
      });
    });

    it('should reject release from non-owner agent', async () => {
      const lock = createFileLock({ lockedByAgent: 'other-agent' });

      prismaMock.fileLock.findUnique.mockResolvedValue(lock);

      const result = await service.releaseLock('src/index.ts', 'agent-1');

      expect(result).toBe(false);
      expect(prismaMock.fileLock.delete).not.toHaveBeenCalled();
    });

    it('should return false if lock does not exist', async () => {
      prismaMock.fileLock.findUnique.mockResolvedValue(null);

      const result = await service.releaseLock('src/nonexistent.ts', 'agent-1');

      expect(result).toBe(false);
    });
  });

  describe('releaseTaskLocks', () => {
    it('should release all locks for a task', async () => {
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.releaseTaskLocks('task-1');

      expect(result).toBe(3);
      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByTask: 'task-1' },
      });
    });
  });

  describe('releaseAgentLocks', () => {
    it('should release all locks for an agent', async () => {
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.releaseAgentLocks('agent-1');

      expect(result).toBe(2);
      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: { lockedByAgent: 'agent-1' },
      });
    });
  });

  describe('getLockedFiles', () => {
    it('should return all active (non-expired) locks', async () => {
      const locks = [
        createFileLock({ filePath: 'src/a.ts' }),
        createFileLock({ filePath: 'src/b.ts' }),
      ];

      prismaMock.fileLock.findMany.mockResolvedValue(locks);

      const result = await service.getLockedFiles();

      expect(result).toHaveLength(2);
      expect(prismaMock.fileLock.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
      });
    });
  });

  describe('isFileLocked', () => {
    it('should return true for active lock', async () => {
      const lock = createFileLock({
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      prismaMock.fileLock.findUnique.mockResolvedValue(lock);

      const result = await service.isFileLocked('src/index.ts');

      expect(result).toBe(true);
    });

    it('should return false for expired lock', async () => {
      const expiredLock = createFileLock({
        expiresAt: new Date(Date.now() - 1000),
      });

      prismaMock.fileLock.findUnique.mockResolvedValue(expiredLock);

      const result = await service.isFileLocked('src/index.ts');

      expect(result).toBe(false);
    });

    it('should return false if no lock exists', async () => {
      prismaMock.fileLock.findUnique.mockResolvedValue(null);

      const result = await service.isFileLocked('src/index.ts');

      expect(result).toBe(false);
    });

    it('should exclude specified agent from lock check', async () => {
      const lock = createFileLock({ lockedByAgent: 'agent-1' });

      prismaMock.fileLock.findUnique.mockResolvedValue(lock);

      const result = await service.isFileLocked('src/index.ts', 'agent-1');

      expect(result).toBe(false); // Not locked for agent-1 (they own it)
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should delete all expired locks', async () => {
      prismaMock.fileLock.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredLocks();

      expect(result).toBe(5);
      expect(prismaMock.fileLock.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
