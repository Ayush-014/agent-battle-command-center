import { config } from '../config.js';
import type { ExecuteTaskRequest, ExecuteTaskResponse, TaskMetrics } from '../types/index.js';

export interface ExecutionCallbacks {
  onStep?: (step: ExecutionStepPayload) => void;
  onProgress?: (progress: number) => void;
  onLog?: (log: string) => void;
}

export interface ExecutionStepPayload {
  taskId: string;
  stepNumber: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_approval';
}

export class ExecutorService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.agents.url;
  }

  async executeTask(
    request: ExecuteTaskRequest,
    callbacks?: ExecutionCallbacks
  ): Promise<ExecuteTaskResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: request.taskId,
          agent_id: request.agentId,
          task_description: request.taskDescription,
          expected_output: request.expectedOutput,
          use_claude: request.useClaude ?? true,
          model: request.model,
          allow_fallback: request.allowFallback ?? true,
          step_by_step: request.stepByStep ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          executionId: '',
          error: `Execution failed: ${error}`,
        };
      }

      const result = await response.json() as {
        success: boolean;
        execution_id: string;
        output?: string;
        metrics?: {
          api_credits_used?: number;
          time_spent_ms?: number;
          iterations?: number;
        };
        error?: string;
      };

      return {
        success: result.success,
        executionId: result.execution_id,
        output: result.output,
        metrics: {
          apiCreditsUsed: result.metrics?.api_credits_used ?? 0,
          timeSpentMs: result.metrics?.time_spent_ms ?? 0,
          iterations: result.metrics?.iterations ?? 1,
        },
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        executionId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeStep(
    taskId: string,
    agentId: string,
    stepNumber: number
  ): Promise<ExecutionStepPayload | null> {
    try {
      const response = await fetch(`${this.baseUrl}/execute/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          agent_id: agentId,
          step_number: stepNumber,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json() as {
        step_number: number;
        action: string;
        description: string;
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_approval';
      };

      return {
        taskId,
        stepNumber: result.step_number,
        action: result.action,
        description: result.description,
        status: result.status,
      };
    } catch (error) {
      console.error('Step execution error:', error);
      return null;
    }
  }

  async approveStep(taskId: string, stepNumber: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/execute/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          step_number: stepNumber,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Step approval error:', error);
      return false;
    }
  }

  async rejectStep(taskId: string, stepNumber: number, reason: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/execute/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          step_number: stepNumber,
          reason,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Step rejection error:', error);
      return false;
    }
  }

  async abortExecution(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/execute/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Abort execution error:', error);
      return false;
    }
  }

  async healthCheck(): Promise<{ status: string; ollama: boolean; claude: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        return { status: 'error', ollama: false, claude: false };
      }
      return await response.json() as { status: string; ollama: boolean; claude: boolean };
    } catch (error) {
      return { status: 'error', ollama: false, claude: false };
    }
  }
}
