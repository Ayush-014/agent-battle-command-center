import { useUIStore } from '../../store/uiState';

const STATUS_COLORS = {
  pending: '#6B7280',
  assigned: '#8B5CF6',
  in_progress: '#3B82F6',
  needs_human: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  aborted: '#6B7280',
};

export function FlowMinimap() {
  const { tasks, selectTask, selectedTaskId, agents } = useUIStore();

  // Filter out tasks older than 24 hours
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentTasks = tasks.filter(task => {
    const taskDate = new Date(task.createdAt).getTime();
    return taskDate > twentyFourHoursAgo;
  });

  // Group tasks by status for flow visualization
  const statusGroups = {
    pending: recentTasks.filter(t => t.status === 'pending'),
    assigned: recentTasks.filter(t => t.status === 'assigned'),
    in_progress: recentTasks.filter(t => t.status === 'in_progress'),
    needs_human: recentTasks.filter(t => t.status === 'needs_human'),
    completed: recentTasks.filter(t => t.status === 'completed'),
    failed: recentTasks.filter(t => ['failed', 'aborted'].includes(t.status)),
  };

  const flowStages = [
    { key: 'pending', label: 'QUEUE', tasks: statusGroups.pending },
    { key: 'assigned', label: 'ASSIGNED', tasks: statusGroups.assigned },
    { key: 'in_progress', label: 'ACTIVE', tasks: statusGroups.in_progress },
    { key: 'needs_human', label: 'BLOCKED', tasks: statusGroups.needs_human },
    { key: 'completed', label: 'COMPLETE', tasks: statusGroups.completed },
    { key: 'failed', label: 'FAILED', tasks: statusGroups.failed },
  ];

  return (
    <div className="h-full minimap p-4 overflow-hidden">
      <div className="relative w-full h-full flex flex-col">
        {/* Agent Status Bar */}
        <div className="flex gap-2 mb-4 pb-2 border-b border-hud-green/30">
          {agents.map(agent => (
            <div
              key={agent.id}
              className={`px-2 py-1 rounded text-xs font-mono ${
                agent.status === 'busy'
                  ? 'bg-blue-500/20 text-blue-400'
                  : agent.status === 'idle'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {agent.agentTypeId.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Horizontal Flow Pipeline */}
        <div className="flex-1 flex gap-3 overflow-x-auto">
          {flowStages.map((stage, stageIndex) => (
            <div key={stage.key} className="flex-1 min-w-[100px] flex flex-col">
              {/* Stage Header */}
              <div className="text-center mb-2 pb-1 border-b border-hud-green/20">
                <div className="text-[10px] font-mono text-hud-green/70 mb-1">
                  {stage.label}
                </div>
                <div className="text-xs font-bold" style={{ color: STATUS_COLORS[stage.key as keyof typeof STATUS_COLORS] }}>
                  {stage.tasks.length}
                </div>
              </div>

              {/* Task Cards in Column */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                {stage.tasks.slice(0, 8).map(task => (
                  <div
                    key={task.id}
                    onClick={() => selectTask(task.id)}
                    className={`p-2 rounded border cursor-pointer transition-all ${
                      selectedTaskId === task.id
                        ? 'border-blue-400 bg-blue-500/20 scale-105'
                        : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full mb-1 mx-auto"
                      style={{ backgroundColor: STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] }}
                    />
                    <div className="text-[8px] text-gray-500 text-center truncate">
                      {task.title.slice(0, 15)}
                    </div>
                  </div>
                ))}

                {/* Overflow indicator */}
                {stage.tasks.length > 8 && (
                  <div className="p-1 text-[8px] text-gray-600 text-center">
                    +{stage.tasks.length - 8} more
                  </div>
                )}
              </div>

              {/* Flow Arrow */}
              {stageIndex < flowStages.length - 1 && (
                <div className="absolute top-1/2 text-hud-green/30 text-2xl" style={{ left: `${((stageIndex + 1) / flowStages.length) * 100}%` }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-2 border-t border-hud-green/20 flex gap-3 text-[8px] text-gray-600">
          <span>Q: Queue</span>
          <span>A: Assigned</span>
          <span>R: Running</span>
          <span>B: Blocked</span>
          <span>✓: Done</span>
          <span>✗: Failed</span>
        </div>
      </div>
    </div>
  );
}
