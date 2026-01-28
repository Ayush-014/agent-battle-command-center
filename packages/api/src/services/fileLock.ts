import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import type { FileLock } from '../types/index.js';

export class FileLockService {
  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {}

  async acquireLock(
    filePath: string,
    agentId: string,
    taskId: string,
    durationMinutes: number = 30
  ): Promise<FileLock | null> {
    const existingLock = await this.prisma.fileLock.findUnique({
      where: { filePath },
    });

    if (existingLock) {
      // Check if lock is expired
      if (existingLock.expiresAt && existingLock.expiresAt < new Date()) {
        // Lock expired, we can take it
        const lock = await this.prisma.fileLock.update({
          where: { filePath },
          data: {
            lockedByAgent: agentId,
            lockedByTask: taskId,
            lockedAt: new Date(),
            expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
          },
        });
        return lock as unknown as FileLock;
      }

      // Lock is active and belongs to another agent/task
      if (existingLock.lockedByAgent !== agentId) {
        this.io.emit('alert', {
          type: 'file_conflict',
          severity: 'warning',
          title: 'File Conflict',
          message: `File ${filePath} is locked by another agent`,
          taskId,
          agentId,
          createdAt: new Date(),
        });
        return null;
      }

      // Same agent, extend the lock
      const lock = await this.prisma.fileLock.update({
        where: { filePath },
        data: {
          expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
        },
      });
      return lock as unknown as FileLock;
    }

    // Create new lock
    const lock = await this.prisma.fileLock.create({
      data: {
        filePath,
        lockedByAgent: agentId,
        lockedByTask: taskId,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      },
    });

    return lock as unknown as FileLock;
  }

  async releaseLock(filePath: string, agentId: string): Promise<boolean> {
    const lock = await this.prisma.fileLock.findUnique({
      where: { filePath },
    });

    if (!lock || lock.lockedByAgent !== agentId) {
      return false;
    }

    await this.prisma.fileLock.delete({
      where: { filePath },
    });

    return true;
  }

  async releaseTaskLocks(taskId: string): Promise<number> {
    const result = await this.prisma.fileLock.deleteMany({
      where: { lockedByTask: taskId },
    });
    return result.count;
  }

  async releaseAgentLocks(agentId: string): Promise<number> {
    const result = await this.prisma.fileLock.deleteMany({
      where: { lockedByAgent: agentId },
    });
    return result.count;
  }

  async getLockedFiles(): Promise<FileLock[]> {
    const locks = await this.prisma.fileLock.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    return locks as unknown as FileLock[];
  }

  async isFileLocked(filePath: string, excludeAgentId?: string): Promise<boolean> {
    const lock = await this.prisma.fileLock.findUnique({
      where: { filePath },
    });

    if (!lock) return false;

    // Check if expired
    if (lock.expiresAt && lock.expiresAt < new Date()) {
      return false;
    }

    // If excluding an agent, check if it's their lock
    if (excludeAgentId && lock.lockedByAgent === excludeAgentId) {
      return false;
    }

    return true;
  }

  async cleanupExpiredLocks(): Promise<number> {
    const result = await this.prisma.fileLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
