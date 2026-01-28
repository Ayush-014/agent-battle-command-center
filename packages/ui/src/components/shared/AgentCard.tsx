import { Code, TestTube, Pause, Play, Square } from 'lucide-react';
import clsx from 'clsx';
import type { Agent } from '@abcc/shared';
import { useUIStore } from '../../store/uiState';
import { useAgents } from '../../hooks/useAgents';

const agentTypeIcons = {
  coder: Code,
  qa: TestTube,
};

const statusDotClasses = {
  idle: 'status-dot-idle',
  busy: 'status-dot-busy',
  stuck: 'status-dot-stuck',
  offline: 'status-dot-offline',
};

interface AgentCardProps {
  agent: Agent;
  compact?: boolean;
  showControls?: boolean;
}

export function AgentCard({ agent, compact = false, showControls = false }: AgentCardProps) {
  const { selectedAgentId, selectAgent, tasks } = useUIStore();
  const { pauseAgent, resumeAgent, abortAgentTask } = useAgents();
  const isSelected = selectedAgentId === agent.id;

  const AgentIcon = agentTypeIcons[agent.type] || Code;
  const currentTask = agent.currentTaskId
    ? tasks.find(t => t.id === agent.currentTaskId)
    : null;

  const handleClick = () => {
    selectAgent(agent.id);
  };

  if (compact) {
    return (
      <div
        className={clsx(
          'agent-card cursor-pointer',
          agent.type,
          isSelected && 'ring-1 ring-hud-blue/50'
        )}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2">
          <div className={`status-dot ${statusDotClasses[agent.status]}`} />
          <AgentIcon className={clsx(
            'w-4 h-4',
            agent.type === 'coder' ? 'text-agent-coder' : 'text-agent-qa'
          )} />
          <span className="text-xs font-medium truncate flex-1">{agent.name}</span>
        </div>
        {currentTask && (
          <div className="mt-2 text-[10px] text-gray-500 truncate pl-6">
            {currentTask.title}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'agent-card cursor-pointer',
        agent.type,
        isSelected && 'ring-1 ring-hud-blue/50'
      )}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          agent.type === 'coder' ? 'bg-agent-coder/20' : 'bg-agent-qa/20'
        )}>
          <AgentIcon className={clsx(
            'w-5 h-5',
            agent.type === 'coder' ? 'text-agent-coder' : 'text-agent-qa'
          )} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{agent.name}</h3>
            <div className={`status-dot ${statusDotClasses[agent.status]}`} />
          </div>
          <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
        </div>
      </div>

      {/* Current Task */}
      {currentTask && (
        <div className="bg-command-bg rounded p-2 mb-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            Current Task
          </div>
          <div className="text-xs truncate">{currentTask.title}</div>
          {currentTask.status === 'in_progress' && (
            <div className="mt-2 h-1 bg-command-accent rounded overflow-hidden">
              <div
                className="h-full bg-hud-blue animate-pulse"
                style={{ width: '50%' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-command-bg rounded p-2">
          <div className="text-gray-500">Completed</div>
          <div className="text-hud-green font-mono">{agent.stats.tasksCompleted}</div>
        </div>
        <div className="bg-command-bg rounded p-2">
          <div className="text-gray-500">Success</div>
          <div className="text-hud-blue font-mono">
            {(agent.stats.successRate * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex gap-2">
          {agent.status === 'busy' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                pauseAgent(agent.id);
              }}
              className="btn-warning flex-1 text-xs py-1"
            >
              <Pause className="w-3 h-3 inline mr-1" />
              Pause
            </button>
          )}
          {agent.status === 'stuck' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                resumeAgent(agent.id);
              }}
              className="btn-success flex-1 text-xs py-1"
            >
              <Play className="w-3 h-3 inline mr-1" />
              Resume
            </button>
          )}
          {agent.currentTaskId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                abortAgentTask(agent.id);
              }}
              className="btn-danger flex-1 text-xs py-1"
            >
              <Square className="w-3 h-3 inline mr-1" />
              Abort
            </button>
          )}
        </div>
      )}
    </div>
  );
}
