import { describe, it, expect } from '@jest/globals';
import {
  calculateLogCost,
  calculateTotalCost,
  aggregateCosts,
  formatCost,
  toDecimal,
  type CostSummary,
} from '../costCalculator.js';
import type { ExecutionLog } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to create mock execution logs
function createMockLog(
  modelUsed: string | null,
  inputTokens: number,
  outputTokens: number
): ExecutionLog {
  return {
    id: 'test-log-' + Math.random(),
    taskId: 'task-123',
    taskExecutionId: 'exec-123',
    stepNumber: 1,
    action: 'test_action',
    input: JSON.stringify({}),
    observation: 'test observation',
    durationMs: 1000,
    isLoopDetected: false,
    modelUsed,
    inputTokens,
    outputTokens,
    createdAt: new Date(),
  } as ExecutionLog;
}

describe('Cost Calculator', () => {
  describe('calculateLogCost', () => {
    it('should calculate cost for Ollama (free)', () => {
      const log = createMockLog('ollama/qwen2.5-coder:7b', 1000, 500);
      expect(calculateLogCost(log)).toBe(0);
    });

    it('should calculate cost for Haiku 4.5', () => {
      const log = createMockLog('claude-haiku-4-5-20251001', 1_000_000, 500_000);
      // Input: (1M / 1M) * $1 = $1
      // Output: (500K / 1M) * $5 = $2.50
      // Total: $3.50
      expect(calculateLogCost(log)).toBeCloseTo(3.5, 6);
    });

    it('should calculate cost for Sonnet 4.5', () => {
      const log = createMockLog('claude-sonnet-4-5-20250929', 500_000, 250_000);
      // Input: (500K / 1M) * $3 = $1.50
      // Output: (250K / 1M) * $15 = $3.75
      // Total: $5.25
      expect(calculateLogCost(log)).toBeCloseTo(5.25, 6);
    });

    it('should calculate cost for Opus 4.5', () => {
      const log = createMockLog('claude-opus-4-5-20251101', 200_000, 100_000);
      // Input: (200K / 1M) * $5 = $1.00
      // Output: (100K / 1M) * $25 = $2.50
      // Total: $3.50
      expect(calculateLogCost(log)).toBeCloseTo(3.5, 6);
    });

    it('should calculate cost for legacy Opus 4', () => {
      const log = createMockLog('claude-opus-4', 100_000, 50_000);
      // Input: (100K / 1M) * $15 = $1.50
      // Output: (50K / 1M) * $75 = $3.75
      // Total: $5.25
      expect(calculateLogCost(log)).toBeCloseTo(5.25, 6);
    });

    it('should handle zero tokens', () => {
      const log = createMockLog('claude-haiku-4-5', 0, 0);
      expect(calculateLogCost(log)).toBe(0);
    });

    it('should handle null model (defaults to free)', () => {
      const log = createMockLog(null, 1000, 500);
      expect(calculateLogCost(log)).toBe(0);
    });

    it('should handle unknown model (defaults to free)', () => {
      const log = createMockLog('unknown-model-xyz', 1000, 500);
      expect(calculateLogCost(log)).toBe(0);
    });

    it('should handle model name with prefix', () => {
      const log = createMockLog('anthropic/claude-sonnet-4-20250514', 100_000, 50_000);
      // Should still match sonnet pricing
      // Input: (100K / 1M) * $3 = $0.30
      // Output: (50K / 1M) * $15 = $0.75
      // Total: $1.05
      expect(calculateLogCost(log)).toBeCloseTo(1.05, 6);
    });

    it('should handle case-insensitive model names', () => {
      const log1 = createMockLog('CLAUDE-HAIKU-4-5', 100_000, 50_000);
      const log2 = createMockLog('claude-haiku-4-5', 100_000, 50_000);

      expect(calculateLogCost(log1)).toEqual(calculateLogCost(log2));
    });

    it('should handle partial version matches', () => {
      const log = createMockLog('claude-haiku-4.5-custom', 100_000, 50_000);
      // Should match haiku-4-5 rate
      // Input: (100K / 1M) * $1 = $0.10
      // Output: (50K / 1M) * $5 = $0.25
      // Total: $0.35
      expect(calculateLogCost(log)).toBeCloseTo(0.35, 6);
    });
  });

  describe('calculateTotalCost', () => {
    it('should sum costs from multiple logs', () => {
      const logs = [
        createMockLog('claude-haiku-4-5', 100_000, 50_000), // $0.35
        createMockLog('claude-sonnet-4', 50_000, 25_000),   // $0.525
        createMockLog('ollama/qwen', 1_000_000, 500_000),   // $0
      ];

      const total = calculateTotalCost(logs);
      expect(total).toBeCloseTo(0.875, 6);
    });

    it('should return 0 for empty logs array', () => {
      expect(calculateTotalCost([])).toBe(0);
    });

    it('should handle logs with zero tokens', () => {
      const logs = [
        createMockLog('claude-haiku-4-5', 0, 0),
        createMockLog('claude-sonnet-4', 0, 0),
      ];

      expect(calculateTotalCost(logs)).toBe(0);
    });
  });

  describe('aggregateCosts', () => {
    it('should aggregate costs with detailed breakdown', () => {
      const logs = [
        createMockLog('claude-haiku-4-5', 100_000, 50_000),  // $0.35
        createMockLog('claude-haiku-4-5', 200_000, 100_000), // $0.70
        createMockLog('claude-sonnet-4', 50_000, 25_000),    // $0.525
        createMockLog('ollama/qwen', 1_000_000, 500_000),    // $0
      ];

      const summary = aggregateCosts(logs);

      // Total cost
      expect(summary.totalCost).toBeCloseTo(1.575, 6);

      // Total tokens
      expect(summary.totalInputTokens).toBe(1_350_000);
      expect(summary.totalOutputTokens).toBe(675_000);

      // Log count
      expect(summary.logCount).toBe(4);

      // By-model breakdown
      expect(summary.byModel['claude-haiku-4-5']).toBeDefined();
      expect(summary.byModel['claude-haiku-4-5'].inputTokens).toBe(300_000);
      expect(summary.byModel['claude-haiku-4-5'].outputTokens).toBe(150_000);
      expect(summary.byModel['claude-haiku-4-5'].cost).toBeCloseTo(1.05, 6);
      expect(summary.byModel['claude-haiku-4-5'].count).toBe(2);

      expect(summary.byModel['claude-sonnet-4']).toBeDefined();
      expect(summary.byModel['claude-sonnet-4'].cost).toBeCloseTo(0.525, 6);
      expect(summary.byModel['claude-sonnet-4'].count).toBe(1);

      // By-tier breakdown
      expect(summary.byModelTier.free).toBe(0);
      expect(summary.byModelTier.haiku).toBeCloseTo(1.05, 6);
      expect(summary.byModelTier.sonnet).toBeCloseTo(0.525, 6);
      expect(summary.byModelTier.opus).toBe(0);
    });

    it('should handle empty logs array', () => {
      const summary = aggregateCosts([]);

      expect(summary.totalCost).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.logCount).toBe(0);
      expect(Object.keys(summary.byModel)).toHaveLength(0);
    });

    it('should group Ollama as free tier', () => {
      const logs = [
        createMockLog('ollama/qwen2.5-coder:7b', 1_000_000, 500_000),
        createMockLog('ollama/llama3.1:8b', 500_000, 250_000),
      ];

      const summary = aggregateCosts(logs);

      expect(summary.byModelTier.free).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.logCount).toBe(2);
    });

    it('should group Opus models correctly', () => {
      const logs = [
        createMockLog('claude-opus-4-5', 100_000, 50_000),  // $1.75
        createMockLog('claude-opus-4', 100_000, 50_000),    // $5.25
      ];

      const summary = aggregateCosts(logs);

      expect(summary.byModelTier.opus).toBeCloseTo(7.0, 6);
      expect(summary.byModelTier.free).toBe(0);
      expect(summary.byModelTier.haiku).toBe(0);
      expect(summary.byModelTier.sonnet).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('should format cost with 6 decimal places', () => {
      expect(formatCost(1.234567)).toBe('$1.234567');
    });

    it('should format zero cost', () => {
      expect(formatCost(0)).toBe('$0.000000');
    });

    it('should format small cost correctly', () => {
      expect(formatCost(0.000123)).toBe('$0.000123');
    });

    it('should format large cost correctly', () => {
      expect(formatCost(123.456789)).toBe('$123.456789');
    });

    it('should round to 6 decimal places', () => {
      expect(formatCost(1.2345678901)).toBe('$1.234568');
    });
  });

  describe('toDecimal', () => {
    it('should convert number to Prisma Decimal', () => {
      const decimal = toDecimal(1.23);
      expect(decimal).toBeInstanceOf(Decimal);
      expect(decimal.toNumber()).toBe(1.23);
    });

    it('should handle zero', () => {
      const decimal = toDecimal(0);
      expect(decimal.toNumber()).toBe(0);
    });

    it('should handle negative numbers', () => {
      const decimal = toDecimal(-1.23);
      expect(decimal.toNumber()).toBe(-1.23);
    });

    it('should handle large numbers', () => {
      const decimal = toDecimal(123456.789);
      expect(decimal.toNumber()).toBe(123456.789);
    });
  });

  describe('model rate normalization edge cases', () => {
    it('should handle whitespace in model names', () => {
      const log1 = createMockLog('  claude-haiku-4-5  ', 100_000, 50_000);
      const log2 = createMockLog('claude-haiku-4-5', 100_000, 50_000);

      expect(calculateLogCost(log1)).toEqual(calculateLogCost(log2));
    });

    it('should handle multiple ollama variants', () => {
      const variants = [
        'ollama',
        'ollama/qwen',
        'ollama/llama',
        'OLLAMA/QWEN',
      ];

      variants.forEach(variant => {
        const log = createMockLog(variant, 100_000, 50_000);
        expect(calculateLogCost(log)).toBe(0);
      });
    });

    it('should default haiku to 4.5 pricing', () => {
      const log = createMockLog('claude-haiku', 100_000, 50_000);
      // Should use haiku-4-5 rate ($1 input, $5 output)
      // Input: (100K / 1M) * $1 = $0.10
      // Output: (50K / 1M) * $5 = $0.25
      // Total: $0.35
      expect(calculateLogCost(log)).toBeCloseTo(0.35, 6);
    });

    it('should handle all sonnet versions with same rate', () => {
      const variants = [
        'claude-sonnet-4',
        'claude-sonnet-4-5',
        'claude-3-5-sonnet',
        'claude-3-7-sonnet',
      ];

      variants.forEach(variant => {
        const log = createMockLog(variant, 100_000, 50_000);
        // All should use $3 input, $15 output
        expect(calculateLogCost(log)).toBeCloseTo(1.05, 6);
      });
    });
  });
});
