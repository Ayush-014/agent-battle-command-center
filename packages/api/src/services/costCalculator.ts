import type { ExecutionLog } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Cost rates per million tokens (input / output)
 * Rates in USD per 1M tokens
 */
const COST_RATES: Record<string, { input: number; output: number }> = {
  // Ollama - free local model
  'ollama': { input: 0, output: 0 },

  // Claude 3.5 Haiku - Fast, cost-effective
  'claude-3-5-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },

  // Claude 3.5 Sonnet - Balanced
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-sonnet-20240620': { input: 3, output: 15 },

  // Claude Sonnet 4.5 - Latest Sonnet
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },

  // Claude Opus 4.5 - Most capable
  'claude-opus-4': { input: 15, output: 75 },
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
};

/**
 * Get the cost rate for a specific model
 */
function getModelRate(modelName: string | null): { input: number; output: number } {
  if (!modelName) {
    return { input: 0, output: 0 };
  }

  // Normalize model name
  const normalizedModel = modelName.toLowerCase().trim();

  // Check for exact match
  if (normalizedModel in COST_RATES) {
    return COST_RATES[normalizedModel];
  }

  // Check for partial matches
  if (normalizedModel.includes('ollama')) {
    return COST_RATES['ollama'];
  }
  if (normalizedModel.includes('haiku')) {
    return COST_RATES['claude-3-5-haiku'];
  }
  if (normalizedModel.includes('sonnet-4') || normalizedModel.includes('sonnet4')) {
    return COST_RATES['claude-sonnet-4'];
  }
  if (normalizedModel.includes('sonnet')) {
    return COST_RATES['claude-3-5-sonnet'];
  }
  if (normalizedModel.includes('opus')) {
    return COST_RATES['claude-opus-4'];
  }

  // Default to zero cost for unknown models
  console.warn(`Unknown model for cost calculation: ${modelName}`);
  return { input: 0, output: 0 };
}

/**
 * Calculate cost for a single execution log entry
 */
export function calculateLogCost(log: ExecutionLog): number {
  const inputTokens = log.inputTokens ?? 0;
  const outputTokens = log.outputTokens ?? 0;
  const model = log.modelUsed;

  if (inputTokens === 0 && outputTokens === 0) {
    return 0;
  }

  const rates = getModelRate(model);

  // Cost = (input_tokens / 1M) * input_rate + (output_tokens / 1M) * output_rate
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}

/**
 * Calculate total cost from multiple execution logs
 */
export function calculateTotalCost(logs: ExecutionLog[]): number {
  return logs.reduce((total, log) => total + calculateLogCost(log), 0);
}

/**
 * Cost summary interface
 */
export interface CostSummary {
  totalCost: number;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    count: number;
  }>;
  byModelTier: {
    free: number;
    haiku: number;
    sonnet: number;
    opus: number;
  };
  totalInputTokens: number;
  totalOutputTokens: number;
  logCount: number;
}

/**
 * Get model tier for grouping
 */
function getModelTier(modelName: string | null): 'free' | 'haiku' | 'sonnet' | 'opus' {
  if (!modelName) return 'free';

  const normalized = modelName.toLowerCase();

  if (normalized.includes('ollama')) return 'free';
  if (normalized.includes('haiku')) return 'haiku';
  if (normalized.includes('opus')) return 'opus';
  if (normalized.includes('sonnet')) return 'sonnet';

  return 'free';
}

/**
 * Aggregate costs from execution logs with detailed breakdown
 */
export function aggregateCosts(logs: ExecutionLog[]): CostSummary {
  const byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    count: number;
  }> = {};

  const byModelTier = {
    free: 0,
    haiku: 0,
    sonnet: 0,
    opus: 0,
  };

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const log of logs) {
    const inputTokens = log.inputTokens ?? 0;
    const outputTokens = log.outputTokens ?? 0;
    const model = log.modelUsed ?? 'unknown';
    const logCost = calculateLogCost(log);

    // Update totals
    totalCost += logCost;
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    // Update by-model breakdown
    if (!byModel[model]) {
      byModel[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        count: 0,
      };
    }

    byModel[model].inputTokens += inputTokens;
    byModel[model].outputTokens += outputTokens;
    byModel[model].cost += logCost;
    byModel[model].count += 1;

    // Update by-tier breakdown
    const tier = getModelTier(model);
    byModelTier[tier] += logCost;
  }

  return {
    totalCost,
    byModel,
    byModelTier,
    totalInputTokens,
    totalOutputTokens,
    logCount: logs.length,
  };
}

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

/**
 * Convert number to Prisma Decimal
 */
export function toDecimal(value: number): Decimal {
  return new Decimal(value);
}
