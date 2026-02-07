import { useUIStore } from '../../store/uiState';
import { TimelineMinimap } from './TimelineMinimap';
import { FlowMinimap } from './FlowMinimap';

const STATUS_COLORS = {
  pending: '#6B7280',
  assigned: '#8B5CF6',
  in_progress: '#3B82F6',
  needs_human: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  aborted: '#6B7280',
};

export function Minimap() {
  const { tasks, selectTask, selectedTaskId, settings } = useUIStore();

  // Use Timeline minimap if selected in settings
  if (settings.minimapStyle === 'timeline') {
    return <TimelineMinimap />;
  }

  // Use Flow minimap if selected in settings
  if (settings.minimapStyle === 'flow') {
    return <FlowMinimap />;
  }

  // Filter out tasks older than 24 hours
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentTasks = tasks.filter(task => {
    const taskDate = new Date(task.createdAt).getTime();
    return taskDate > twentyFourHoursAgo;
  });

  // Calculate positions for tasks in a grid-like pattern
  const getTaskPosition = (index: number, total: number) => {
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const padding = 15;
    const width = 100 - padding * 2;
    const height = 100 - padding * 2;

    return {
      x: padding + (col / (cols - 1 || 1)) * width,
      y: padding + (row / (Math.ceil(total / cols) - 1 || 1)) * height,
    };
  };

  // Sort tasks by status for better visualization
  const sortedTasks = [...recentTasks].sort((a, b) => {
    const order = ['in_progress', 'assigned', 'needs_human', 'pending', 'completed', 'failed', 'aborted'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className="h-full minimap minimap-grid p-2">
      <div className="relative w-full h-full">
        {/* Radar sweep effect */}
        <div className="radar-sweep" />

        {/* Radar concentric rings */}
        <div className="radar-rings" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-30">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Horizontal lines */}
            {[20, 40, 60, 80].map(y => (
              <line
                key={`h-${y}`}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-hud-green"
              />
            ))}
            {/* Vertical lines */}
            {[20, 40, 60, 80].map(x => (
              <line
                key={`v-${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2="100"
                stroke="currentColor"
                strokeWidth="0.2"
                className="text-hud-green"
              />
            ))}
          </svg>
        </div>

        {/* Task dots */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {sortedTasks.map((task, index) => {
            const pos = getTaskPosition(index, sortedTasks.length);
            const isSelected = task.id === selectedTaskId;
            const isActive = ['in_progress', 'assigned'].includes(task.status);

            return (
              <g key={task.id}>
                {/* Glow effect for active tasks */}
                {isActive && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={6}
                    fill={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}
                    opacity={0.3}
                    className="animate-pulse"
                  />
                )}

                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={5}
                    fill="none"
                    stroke="#00aaff"
                    strokeWidth={1}
                    className="animate-pulse"
                  />
                )}

                {/* Task dot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={3}
                  fill={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => selectTask(task.id)}
                >
                  <title>{task.title} ({task.status})</title>
                </circle>
              </g>
            );
          })}

          {/* Connection lines for assigned tasks to their agents */}
          {sortedTasks
            .filter(t => t.assignedAgentId && ['in_progress', 'assigned'].includes(t.status))
            .map((task) => {
              const pos = getTaskPosition(
                sortedTasks.findIndex(t => t.id === task.id),
                sortedTasks.length
              );

              // Draw line to center (representing agent area)
              return (
                <line
                  key={`line-${task.id}`}
                  x1={pos.x}
                  y1={pos.y}
                  x2={50}
                  y2={90}
                  stroke={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                  opacity={0.5}
                />
              );
            })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-1 left-1 flex gap-2 text-[8px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-active" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-stuck" />
            Stuck
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-pending" />
            Pending
          </span>
        </div>
      </div>
    </div>
  );
}
