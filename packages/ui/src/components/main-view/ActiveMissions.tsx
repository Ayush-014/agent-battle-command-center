import { ArrowRight, AlertTriangle, Loader } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import type { Agent, Task } from '@abcc/shared';

interface CompactMissionProps {
  agent: Agent;
  task: Task;
}

function CompactMission({ agent, task }: CompactMissionProps) {
  const progress = Math.min((task.currentIteration / task.maxIterations) * 100, 100);
  const isStuck = task.status === 'needs_human';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      isStuck ? 'border-hud-amber/50 bg-hud-amber/5' : 'border-command-border bg-command-panel'
    }`}>
      {/* Agent indicator */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        agent.type === 'coder' ? 'bg-agent-coder' :
        agent.type === 'qa' ? 'bg-agent-qa' : 'bg-agent-cto'
      }`} />

      {/* Agent name */}
      <span className="text-[10px] text-gray-500 w-16 truncate">{agent.name}</span>

      <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />

      {/* Task title */}
      <span className="text-xs truncate flex-1 min-w-0">{task.title}</span>

      {/* Status */}
      {isStuck ? (
        <AlertTriangle className="w-3 h-3 text-hud-amber flex-shrink-0" />
      ) : (
        <Loader className="w-3 h-3 text-hud-blue flex-shrink-0 animate-spin" style={{ animationDuration: '2s' }} />
      )}

      {/* Mini progress */}
      <div className="w-12 h-1.5 bg-command-accent rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full ${isStuck ? 'bg-hud-amber' : 'bg-hud-blue'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-[10px] text-gray-500 w-8">{task.currentIteration}/{task.maxIterations}</span>
    </div>
  );
}

export function ActiveMissions() {
  const { tasks, agents } = useUIStore();

  const activeTasks = tasks.filter(t =>
    ['assigned', 'in_progress', 'needs_human'].includes(t.status)
  );

  // Get missions (agent + task pairs)
  const missions = activeTasks
    .filter(t => t.assignedAgentId)
    .map(task => ({
      task,
      agent: agents.find(a => a.id === task.assignedAgentId)!,
    }))
    .filter(m => m.agent);

  // Tasks waiting for human input
  const stuckTasks = activeTasks.filter(t => t.status === 'needs_human');

  return (
    <div className="h-full flex flex-col bg-command-bg">
      {/* Compact Header */}
      <div className="px-3 py-2 border-t border-command-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs uppercase tracking-wider text-gray-400">
            Running
          </h2>
          <span className="text-[10px] text-gray-500">
            {missions.length} active
          </span>
        </div>

        {stuckTasks.length > 0 && (
          <div className="flex items-center gap-1 text-hud-amber text-[10px]">
            <AlertTriangle className="w-3 h-3" />
            {stuckTasks.length} stuck
          </div>
        )}
      </div>

      {/* Horizontal scrolling mission strip */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 pb-2">
        {missions.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-xs">
            No active tasks - agents idle
          </div>
        ) : (
          <div className="flex gap-2 h-full items-center">
            {missions.map(({ agent, task }) => (
              <div key={task.id} className="flex-shrink-0">
                <CompactMission agent={agent} task={task} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
