import { useState, useEffect } from 'react';
import { Check, X, Edit, Play, Loader } from 'lucide-react';
import type { Task, Agent } from '@abcc/shared';
import { executeApi } from '../../api/client';

interface StepViewProps {
  task: Task | null;
  agent: Agent | null;
  onLog: (message: string) => void;
}

interface Step {
  number: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'awaiting_approval';
  proposedChange?: string;
}

export function StepView({ task, agent, onLog }: StepViewProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset when task changes
    setSteps([]);
    setCurrentStep(0);
  }, [task?.id]);

  const executeNextStep = async () => {
    if (!task) return;

    setLoading(true);
    onLog(`Executing step ${currentStep + 1}...`);

    try {
      const result = await executeApi.step(task.id, currentStep);

      const newStep: Step = {
        number: result.stepNumber,
        action: result.action,
        description: result.description,
        status: result.status,
        proposedChange: result.action === 'modify'
          ? `// Proposed change for step ${result.stepNumber}\nconst example = "new code";`
          : undefined,
      };

      setSteps(prev => [...prev, newStep]);
      onLog(`Step ${currentStep + 1}: ${result.action} - ${result.description}`);

      if (result.status === 'awaiting_approval') {
        onLog('⏸️ Waiting for human approval');
      }
    } catch (error) {
      onLog(`Error executing step: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const approveStep = async (stepNumber: number) => {
    if (!task) return;

    setLoading(true);
    onLog(`Approving step ${stepNumber + 1}...`);

    try {
      await executeApi.approve(task.id, stepNumber);

      setSteps(prev =>
        prev.map(s =>
          s.number === stepNumber ? { ...s, status: 'completed' } : s
        )
      );

      onLog(`✓ Step ${stepNumber + 1} approved`);
      setCurrentStep(stepNumber + 1);
    } catch (error) {
      onLog(`Error approving step: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const rejectStep = async (stepNumber: number) => {
    if (!task) return;

    setLoading(true);
    onLog(`Rejecting step ${stepNumber + 1}...`);

    try {
      await executeApi.reject(task.id, stepNumber, 'Rejected by human');

      setSteps(prev =>
        prev.map(s =>
          s.number === stepNumber ? { ...s, status: 'failed' } : s
        )
      );

      onLog(`✗ Step ${stepNumber + 1} rejected`);
    } catch (error) {
      onLog(`Error rejecting step: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p>No task selected</p>
          <p className="text-xs mt-1">Select a task to view step-by-step execution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Task Info */}
      <div className="mb-4">
        <h3 className="text-lg font-medium">{task.title}</h3>
        {agent && (
          <p className="text-xs text-gray-500">
            Assigned to {agent.name}
          </p>
        )}
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {steps.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No steps executed yet</p>
            <p className="text-xs mt-1">Click "Execute Next Step" to begin</p>
          </div>
        ) : (
          steps.map((step) => (
            <div
              key={step.number}
              className={`border rounded-lg p-4 ${
                step.status === 'awaiting_approval'
                  ? 'border-hud-amber/50 bg-hud-amber/5'
                  : step.status === 'completed'
                    ? 'border-hud-green/30'
                    : step.status === 'failed'
                      ? 'border-hud-red/30'
                      : 'border-command-border'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-display uppercase tracking-wider text-gray-500">
                    Step {step.number + 1}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    step.status === 'completed' ? 'bg-hud-green/20 text-hud-green' :
                    step.status === 'failed' ? 'bg-hud-red/20 text-hud-red' :
                    step.status === 'awaiting_approval' ? 'bg-hud-amber/20 text-hud-amber' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {step.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-gray-500 capitalize">{step.action}</span>
              </div>

              {/* Step Description */}
              <p className="text-sm mb-3">{step.description}</p>

              {/* Proposed Change */}
              {step.proposedChange && (
                <div className="bg-command-bg rounded p-3 mb-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-hud-green">{step.proposedChange}</pre>
                </div>
              )}

              {/* Approval Actions */}
              {step.status === 'awaiting_approval' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveStep(step.number)}
                    disabled={loading}
                    className="flex-1 btn-success text-xs py-1.5"
                  >
                    <Check className="w-3 h-3 inline mr-1" />
                    Approve
                  </button>
                  <button
                    disabled={loading}
                    className="flex-1 btn-primary text-xs py-1.5"
                  >
                    <Edit className="w-3 h-3 inline mr-1" />
                    Edit & Approve
                  </button>
                  <button
                    onClick={() => rejectStep(step.number)}
                    disabled={loading}
                    className="flex-1 btn-danger text-xs py-1.5"
                  >
                    <X className="w-3 h-3 inline mr-1" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Execute Button */}
      <div className="flex gap-2">
        <button
          onClick={executeNextStep}
          disabled={loading || steps.some(s => s.status === 'awaiting_approval')}
          className="flex-1 btn-primary disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 inline mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 inline mr-2" />
              Execute Next Step
            </>
          )}
        </button>
      </div>
    </div>
  );
}
