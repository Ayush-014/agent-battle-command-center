import { Pause, Play, Square, UserCog } from 'lucide-react';
import type { Task, Agent } from '@abcc/shared';
import { AgentCard } from '../shared/AgentCard';
import { useAgents } from '../../hooks/useAgents';
import { useUIStore } from '../../store/uiState';

interface AgentOverrideProps {
  agent: Agent | null;
  task: Task | null;
  onLog: (message: string) => void;
}

export function AgentOverride({ agent, task, onLog }: AgentOverrideProps) {
  const { agents } = useUIStore();
  const { pauseAgent, resumeAgent, abortAgentTask, assignTaskToAgent, loading } = useAgents();

  // Get idle agents for reassignment
  const idleAgents = agents.filter(a => a.status === 'idle');

  const handlePause = async () => {
    if (!agent) return;
    onLog(`Pausing ${agent.name}...`);
    await pauseAgent(agent.id);
    onLog(`${agent.name} paused`);
  };

  const handleResume = async () => {
    if (!agent) return;
    onLog(`Resuming ${agent.name}...`);
    await resumeAgent(agent.id);
    onLog(`${agent.name} resumed`);
  };

  const handleAbort = async () => {
    if (!agent) return;
    onLog(`Aborting ${agent.name}'s current task...`);
    await abortAgentTask(agent.id);
    onLog(`Task aborted`);
  };

  const handleReassign = async (newAgentId: string) => {
    if (!task) return;
    const newAgent = agents.find(a => a.id === newAgentId);
    if (!newAgent) return;

    onLog(`Reassigning task to ${newAgent.name}...`);
    await assignTaskToAgent(task.id, newAgentId);
    onLog(`Task reassigned to ${newAgent.name}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-command-border">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-gray-400" />
          <span className="font-display text-xs uppercase tracking-wider text-gray-400">
            Agent Control
          </span>
        </div>
      </div>

      {/* Agent Info */}
      <div className="p-4 border-b border-command-border">
        {agent ? (
          <AgentCard agent={agent} />
        ) : (
          <div className="text-center text-gray-500 text-sm py-4">
            No agent assigned
          </div>
        )}
      </div>

      {/* Controls */}
      {agent && (
        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Controls
          </div>

          <div className="grid grid-cols-2 gap-2">
            {agent.status === 'busy' && (
              <button
                onClick={handlePause}
                disabled={loading}
                className="btn-warning text-xs py-2"
              >
                <Pause className="w-3 h-3 inline mr-1" />
                Pause
              </button>
            )}

            {agent.status === 'stuck' && (
              <button
                onClick={handleResume}
                disabled={loading}
                className="btn-success text-xs py-2"
              >
                <Play className="w-3 h-3 inline mr-1" />
                Resume
              </button>
            )}

            {agent.currentTaskId && (
              <button
                onClick={handleAbort}
                disabled={loading}
                className="btn-danger text-xs py-2"
              >
                <Square className="w-3 h-3 inline mr-1" />
                Abort Task
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reassign */}
      {task && idleAgents.length > 0 && (
        <div className="p-4 border-t border-command-border">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Reassign To
          </div>

          <select
            onChange={(e) => {
              if (e.target.value) {
                handleReassign(e.target.value);
                e.target.value = '';
              }
            }}
            className="w-full bg-command-bg border border-command-border rounded px-3 py-2 text-sm focus:outline-none focus:border-hud-blue"
            disabled={loading}
          >
            <option value="">Select agent...</option>
            {idleAgents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quick Stats */}
      {agent && (
        <div className="mt-auto p-4 border-t border-command-border">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Agent Stats
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-command-bg rounded p-2">
              <div className="text-gray-500">Completed</div>
              <div className="text-hud-green font-mono">{agent.stats.tasksCompleted}</div>
            </div>
            <div className="bg-command-bg rounded p-2">
              <div className="text-gray-500">Failed</div>
              <div className="text-hud-red font-mono">{agent.stats.tasksFailed}</div>
            </div>
            <div className="bg-command-bg rounded p-2">
              <div className="text-gray-500">Success Rate</div>
              <div className="text-hud-blue font-mono">
                {(agent.stats.successRate * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-command-bg rounded p-2">
              <div className="text-gray-500">Credits Used</div>
              <div className="text-hud-purple font-mono">
                {agent.stats.totalApiCredits.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
