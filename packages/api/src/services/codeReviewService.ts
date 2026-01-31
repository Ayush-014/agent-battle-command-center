/**
 * Code Review Service - Auto-trigger code reviews on task completion
 *
 * Uses Claude Opus to analyze completed code for:
 * - Code quality (0-10 score)
 * - Bugs and issues (critical/high/medium/low)
 * - Best practices and suggestions
 *
 * Cost: ~$0.02 per review (Opus)
 */

import type { PrismaClient, Task } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import Anthropic from '@anthropic-ai/sdk';

export interface CodeReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  qualityScore: number;
  findings: CodeReviewFinding[];
  summary: string;
  approved: boolean;
  inputTokens: number;
  outputTokens: number;
}

// Task types that should NOT be reviewed
const SKIP_REVIEW_TYPES = ['review', 'decomposition', 'debug'];

// Minimum complexity to trigger review (skip trivial tasks)
const MIN_COMPLEXITY_FOR_REVIEW = 3;

export class CodeReviewService {
  private anthropic: Anthropic | null = null;
  private enabled: boolean = true;

  constructor(
    private prisma: PrismaClient,
    private io: SocketIOServer
  ) {
    // Initialize Anthropic client if API key available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      console.warn('CodeReviewService: ANTHROPIC_API_KEY not set, auto-review disabled');
      this.enabled = false;
    }
  }

  /**
   * Check if a task should be auto-reviewed
   */
  shouldReview(task: Task): boolean {
    if (!this.enabled) return false;

    // Skip certain task types
    if (SKIP_REVIEW_TYPES.includes(task.taskType || '')) {
      return false;
    }

    // Skip trivial tasks (complexity < 3)
    const complexity = task.finalComplexity || task.routerComplexity || 5;
    if (complexity < MIN_COMPLEXITY_FOR_REVIEW) {
      return false;
    }

    // Skip failed tasks
    if (task.status !== 'completed') {
      return false;
    }

    return true;
  }

  /**
   * Trigger code review for a completed task (async, non-blocking)
   */
  async triggerReview(taskId: string): Promise<void> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: { assignedAgent: true },
      });

      if (!task) {
        console.error(`CodeReviewService: Task ${taskId} not found`);
        return;
      }

      if (!this.shouldReview(task)) {
        console.log(`CodeReviewService: Skipping review for task ${taskId} (${task.taskType}, complexity ${task.finalComplexity})`);
        return;
      }

      // Check if already reviewed
      const existingReview = await this.prisma.codeReview.findFirst({
        where: { taskId },
      });

      if (existingReview) {
        console.log(`CodeReviewService: Task ${taskId} already reviewed`);
        return;
      }

      console.log(`CodeReviewService: Starting review for task ${taskId}`);

      // Get execution logs for context
      const executionLogs = await this.prisma.executionLog.findMany({
        where: { taskId },
        orderBy: { step: 'asc' },
        take: 20, // Limit to last 20 actions
      });

      // Extract code from execution logs
      const codeContent = this.extractCodeFromLogs(executionLogs, task);

      if (!codeContent) {
        console.log(`CodeReviewService: No code found for task ${taskId}`);
        return;
      }

      // Perform the review
      const reviewResult = await this.performReview(task, codeContent);

      // Create code review record
      const review = await this.prisma.codeReview.create({
        data: {
          taskId,
          reviewerId: 'auto-review',
          reviewerModel: 'claude-opus-4-20250514',
          initialComplexity: task.finalComplexity || task.routerComplexity || 5,
          opusComplexity: reviewResult.qualityScore, // Use quality score as complexity indicator
          findings: reviewResult.findings as unknown as undefined,
          summary: reviewResult.summary,
          codeQualityScore: reviewResult.qualityScore,
          status: reviewResult.approved ? 'approved' : 'needs_fixes',
          inputTokens: reviewResult.inputTokens,
          outputTokens: reviewResult.outputTokens,
          totalCost: this.calculateCost(reviewResult.inputTokens, reviewResult.outputTokens),
        },
      });

      // Emit event
      this.io.emit('code_review_completed', {
        type: 'code_review_completed',
        payload: {
          taskId,
          reviewId: review.id,
          qualityScore: reviewResult.qualityScore,
          approved: reviewResult.approved,
          findingsCount: reviewResult.findings.length,
        },
        timestamp: new Date(),
      });

      console.log(`CodeReviewService: Review completed for task ${taskId} - Score: ${reviewResult.qualityScore}/10, Approved: ${reviewResult.approved}`);
    } catch (error) {
      console.error(`CodeReviewService: Error reviewing task ${taskId}:`, error);
    }
  }

  /**
   * Extract code content from execution logs
   */
  private extractCodeFromLogs(logs: Array<{ action: string; actionInput: unknown; observation: string | null }>, task: Task): string | null {
    const codeBlocks: string[] = [];

    for (const log of logs) {
      // Look for file_write actions
      if (log.action === 'file_write' && log.actionInput) {
        const input = log.actionInput as { path?: string; content?: string };
        if (input.content) {
          codeBlocks.push(`// File: ${input.path || 'unknown'}\n${input.content}`);
        }
      }

      // Look for code in observations
      if (log.observation && (log.observation.includes('def ') || log.observation.includes('function ') || log.observation.includes('class '))) {
        // Extract code blocks from observation
        const codeMatch = log.observation.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeMatch) {
          codeBlocks.push(codeMatch[1]);
        }
      }
    }

    // Also check task result for code
    const result = task.result as { output?: string; code?: string } | null;
    if (result?.code) {
      codeBlocks.push(result.code);
    }

    return codeBlocks.length > 0 ? codeBlocks.join('\n\n---\n\n') : null;
  }

  /**
   * Perform code review using Claude Opus
   */
  private async performReview(task: Task, codeContent: string): Promise<CodeReviewResult> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemPrompt = `You are an expert code reviewer. Analyze the provided code and return a JSON response with:
- qualityScore: 0-10 (10 = excellent)
- findings: array of issues found
- summary: brief overall assessment
- approved: boolean (true if qualityScore >= 7 and no critical/high issues)

For each finding, include:
- severity: "critical" | "high" | "medium" | "low"
- category: e.g., "bug", "security", "performance", "style", "best-practice"
- description: what the issue is
- suggestion: how to fix it

Be constructive and specific. Focus on actual issues, not style preferences.`;

    const userPrompt = `Review this code for task: "${task.title}"

Task Description: ${task.description}

Code:
\`\`\`
${codeContent.substring(0, 8000)}
\`\`\`

Return ONLY valid JSON matching this schema:
{
  "qualityScore": number,
  "findings": [{"severity": string, "category": string, "description": string, "suggestion": string}],
  "summary": string,
  "approved": boolean
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      qualityScore: Math.min(10, Math.max(0, result.qualityScore || 5)),
      findings: result.findings || [],
      summary: result.summary || 'Review completed',
      approved: result.approved ?? (result.qualityScore >= 7),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  /**
   * Calculate cost for Opus review
   * Opus pricing: $15/M input, $75/M output
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * 15;
    const outputCost = (outputTokens / 1_000_000) * 75;
    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
  }

  /**
   * Enable/disable auto-review
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`CodeReviewService: Auto-review ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.anthropic !== null;
  }
}
