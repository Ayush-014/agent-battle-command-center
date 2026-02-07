import { describe, it, expect, beforeEach } from 'vitest';
import { ResourcePoolService } from '../resourcePool.js';

describe('ResourcePoolService', () => {
  let resourcePool: ResourcePoolService;

  beforeEach(() => {
    // Get singleton and clear state
    resourcePool = ResourcePoolService.getInstance();
    resourcePool.clear();
  });

  describe('acquire', () => {
    it('should acquire Ollama slot when available', () => {
      const result = resourcePool.acquire('ollama', 'task-1');
      expect(result).toBe(true);

      const status = resourcePool.getResourceStatus('ollama');
      expect(status.activeSlots).toBe(1);
      expect(status.activeTasks).toContain('task-1');
    });

    it('should acquire Claude slot when available', () => {
      const result = resourcePool.acquire('claude', 'task-1');
      expect(result).toBe(true);

      const status = resourcePool.getResourceStatus('claude');
      expect(status.activeSlots).toBe(1);
      expect(status.activeTasks).toContain('task-1');
    });

    it('should reject when Ollama slot is full (1 max)', () => {
      resourcePool.acquire('ollama', 'task-1');
      const result = resourcePool.acquire('ollama', 'task-2');

      expect(result).toBe(false);

      const status = resourcePool.getResourceStatus('ollama');
      expect(status.activeSlots).toBe(1);
      expect(status.activeTasks).toHaveLength(1);
    });

    it('should allow 2 Claude tasks simultaneously', () => {
      const result1 = resourcePool.acquire('claude', 'task-1');
      const result2 = resourcePool.acquire('claude', 'task-2');

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      const status = resourcePool.getResourceStatus('claude');
      expect(status.activeSlots).toBe(2);
      expect(status.activeTasks).toHaveLength(2);
    });

    it('should reject 3rd Claude task', () => {
      resourcePool.acquire('claude', 'task-1');
      resourcePool.acquire('claude', 'task-2');
      const result3 = resourcePool.acquire('claude', 'task-3');

      expect(result3).toBe(false);

      const status = resourcePool.getResourceStatus('claude');
      expect(status.activeSlots).toBe(2);
      expect(status.activeTasks).toHaveLength(2);
    });

    it('should allow parallel Ollama + Claude execution', () => {
      const ollamaResult = resourcePool.acquire('ollama', 'ollama-task');
      const claudeResult = resourcePool.acquire('claude', 'claude-task');

      expect(ollamaResult).toBe(true);
      expect(claudeResult).toBe(true);

      // Both resources in use simultaneously
      const ollamaStatus = resourcePool.getResourceStatus('ollama');
      const claudeStatus = resourcePool.getResourceStatus('claude');

      expect(ollamaStatus.activeSlots).toBe(1);
      expect(claudeStatus.activeSlots).toBe(1);
    });
  });

  describe('release', () => {
    it('should release Ollama slot', () => {
      resourcePool.acquire('ollama', 'task-1');
      resourcePool.release('ollama', 'task-1');

      const status = resourcePool.getResourceStatus('ollama');
      expect(status.activeSlots).toBe(0);
      expect(status.activeTasks).toHaveLength(0);
    });

    it('should release Claude slot', () => {
      resourcePool.acquire('claude', 'task-1');
      resourcePool.release('claude', 'task-1');

      const status = resourcePool.getResourceStatus('claude');
      expect(status.activeSlots).toBe(0);
      expect(status.activeTasks).toHaveLength(0);
    });

    it('should allow re-acquire after release', () => {
      resourcePool.acquire('ollama', 'task-1');
      resourcePool.release('ollama', 'task-1');
      const result = resourcePool.acquire('ollama', 'task-2');

      expect(result).toBe(true);

      const status = resourcePool.getResourceStatus('ollama');
      expect(status.activeSlots).toBe(1);
      expect(status.activeTasks).toContain('task-2');
    });

    it('should handle releasing non-existent task gracefully', () => {
      expect(() => {
        resourcePool.release('ollama', 'non-existent-task');
      }).not.toThrow();

      const status = resourcePool.getResourceStatus('ollama');
      expect(status.activeSlots).toBe(0);
    });

    it('should release specific task from multiple Claude tasks', () => {
      resourcePool.acquire('claude', 'task-1');
      resourcePool.acquire('claude', 'task-2');
      resourcePool.release('claude', 'task-1');

      const status = resourcePool.getResourceStatus('claude');
      expect(status.activeSlots).toBe(1);
      expect(status.activeTasks).toContain('task-2');
      expect(status.activeTasks).not.toContain('task-1');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', () => {
      expect(resourcePool.isAvailable('ollama')).toBe(true);
    });

    it('should return false when Ollama is busy', () => {
      resourcePool.acquire('ollama', 'task-1');
      expect(resourcePool.isAvailable('ollama')).toBe(false);
    });

    it('should return true when Claude has slots', () => {
      resourcePool.acquire('claude', 'task-1');
      expect(resourcePool.isAvailable('claude')).toBe(true); // Still 1 slot left
    });

    it('should return false when all Claude slots are full', () => {
      resourcePool.acquire('claude', 'task-1');
      resourcePool.acquire('claude', 'task-2');
      expect(resourcePool.isAvailable('claude')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status for all resources', () => {
      resourcePool.acquire('ollama', 'ollama-task');
      resourcePool.acquire('claude', 'claude-task');

      const status = resourcePool.getStatus();

      expect(status.resources).toHaveLength(2);
      expect(status.limits).toEqual({ ollama: 1, claude: 2 });

      const ollamaResource = status.resources.find(r => r.type === 'ollama');
      const claudeResource = status.resources.find(r => r.type === 'claude');

      expect(ollamaResource?.activeSlots).toBe(1);
      expect(claudeResource?.activeSlots).toBe(1);
    });

    it('should include summary with active counts', () => {
      const status = resourcePool.getStatus();

      expect(status.summary).toBeDefined();
      expect(status.summary.ollama).toBeDefined();
      expect(status.summary.claude).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all active tasks', () => {
      resourcePool.acquire('ollama', 'task-1');
      resourcePool.acquire('claude', 'task-2');
      resourcePool.acquire('claude', 'task-3');

      resourcePool.clear();

      const ollamaStatus = resourcePool.getResourceStatus('ollama');
      const claudeStatus = resourcePool.getResourceStatus('claude');

      expect(ollamaStatus.activeSlots).toBe(0);
      expect(claudeStatus.activeSlots).toBe(0);
      expect(ollamaStatus.activeTasks).toHaveLength(0);
      expect(claudeStatus.activeTasks).toHaveLength(0);
    });
  });
});
