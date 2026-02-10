import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BudgetService } from '../budgetService.js';

describe('BudgetService', () => {
  let budgetService: BudgetService;

  beforeEach(() => {
    // Get singleton instance and reset state
    budgetService = BudgetService.getInstance();
    budgetService.setConfig({ dailyLimitCents: 500, warningThreshold: 0.8, enabled: true });
  });

  describe('recordUsage', () => {
    it('should track daily spending', () => {
      // Haiku: $1 input, $5 output per 1M tokens
      // 1000 input, 500 output = $0.0015 + $0.0025 = $0.004 = 0.4 cents
      budgetService.recordUsage(1000, 500, 'claude-haiku-4-5-20251001');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBeGreaterThan(0);
      expect(status.allTimeSpentCents).toBeGreaterThan(0);
      expect(status.isOverBudget).toBe(false);
    });

    it('should trigger warning at 80% threshold', () => {
      // Use large token counts to hit warning threshold (80% of 500 cents = 400 cents)
      // Opus: $5 input, $25 output per 1M tokens
      // Need ~16M input tokens or ~3.2M output tokens to hit 400 cents
      budgetService.recordUsage(8000000, 800000, 'claude-opus-4-5-20251101');

      const status = budgetService.getStatus();
      expect(status.isWarning).toBe(true);
      expect(status.isOverBudget).toBe(false);
    });

    it('should block Claude when over budget', () => {
      // Use enough tokens to exceed 500 cents budget
      budgetService.recordUsage(10000000, 1000000, 'claude-opus-4-5-20251101');

      const status = budgetService.getStatus();
      expect(status.isOverBudget).toBe(true);
      expect(budgetService.isClaudeBlocked()).toBe(true);
    });

    it('should accumulate multiple costs', () => {
      budgetService.recordUsage(1000, 500, 'claude-haiku-4-5-20251001');
      budgetService.recordUsage(2000, 1000, 'claude-sonnet-4-20250514');
      budgetService.recordUsage(3000, 1500, 'claude-opus-4-5-20251101');

      const status = budgetService.getStatus();
      expect(status.dailySpentCents).toBeGreaterThan(0);
      expect(status.allTimeSpentCents).toBeGreaterThan(0);
    });
  });

  describe('isClaudeBlocked', () => {
    it('should allow requests when under budget', () => {
      const result = budgetService.isClaudeBlocked();
      expect(result).toBe(false);
    });

    it('should block requests when over budget', () => {
      budgetService.recordUsage(10000000, 1000000, 'claude-opus-4-5-20251101');

      const result = budgetService.isClaudeBlocked();
      expect(result).toBe(true);
    });

    it('should allow requests when budget is disabled', () => {
      budgetService.setConfig({ enabled: false });
      budgetService.recordUsage(10000000, 1000000, 'claude-opus-4-5-20251101');

      const result = budgetService.isClaudeBlocked();
      expect(result).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update daily limit', () => {
      budgetService.setConfig({ dailyLimitCents: 1000 });

      const status = budgetService.getStatus();
      expect(status.dailyLimitCents).toBe(1000);
    });

    it('should update warning threshold', () => {
      budgetService.setConfig({ warningThreshold: 0.9 });

      // Warning should trigger at 90% instead of 80%
      budgetService.recordUsage(450, 'haiku', 'task-1').then(() => {
        const status = budgetService.getStatus();
        expect(status.isWarning).toBe(false); // 450/500 = 90%, exactly at threshold
      });
    });

    it('should enable/disable budget enforcement', async () => {
      budgetService.setConfig({ enabled: false });
      await budgetService.recordUsage(1000, 'opus', 'expensive-task');

      const status = budgetService.getStatus();
      expect(status.claudeBlocked).toBe(false); // Not blocked when disabled
    });
  });

  describe('calculateTaskCost', () => {
    it('should calculate Haiku cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'haiku');
      // (1000 * 100 / 1M) + (500 * 500 / 1M) = 0.1 + 0.25 = 0.35 cents
      expect(cost).toBeCloseTo(0.35);
    });

    it('should calculate Sonnet cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'sonnet');
      // (1000 * 300 / 1M) + (500 * 1500 / 1M) = 0.3 + 0.75 = 1.05 cents
      expect(cost).toBeCloseTo(1.05);
    });

    it('should calculate Opus cost correctly', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'opus');
      // (1000 * 500 / 1M) + (500 * 2500 / 1M) = 0.5 + 1.25 = 1.75 cents
      expect(cost).toBeCloseTo(1.75);
    });

    it('should return 0 for Ollama (free)', () => {
      const cost = budgetService.calculateTaskCost(1000, 500, 'ollama');
      expect(cost).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should include cost per task stats', async () => {
      await budgetService.recordUsage(10, 'haiku', 'task-1');
      await budgetService.recordUsage(20, 'sonnet', 'task-2');
      await budgetService.recordUsage(30, 'opus', 'task-3');

      const status = budgetService.getStatus();
      expect(status.costPerTask).toBeDefined();
      expect(status.costPerTask.totalTasks).toBe(3);
      expect(status.costPerTask.avgCostCents).toBeCloseTo(20); // (10+20+30)/3
    });

    it('should format display values correctly', () => {
      const status = budgetService.getStatus();
      expect(status.display).toBeDefined();
      expect(status.display.dailySpent).toMatch(/^\$/);
      expect(status.display.dailyLimit).toMatch(/^\$/);
      expect(status.display.avgCostPerTask).toMatch(/^\$/);
    });

    it('should include reset time for tomorrow midnight UTC', () => {
      const status = budgetService.getStatus();
      const resetTime = new Date(status.resetTime);

      expect(resetTime.getUTCHours()).toBe(0);
      expect(resetTime.getUTCMinutes()).toBe(0);
      expect(resetTime.getUTCSeconds()).toBe(0);
      expect(resetTime.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
