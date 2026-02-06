import { useState, useMemo } from 'react';
import { StepView } from './StepView';
import { AgentOverride } from './AgentOverride';
import { useUIStore } from '../../store/uiState';
import { useExecutionLogs } from '../../hooks/useExecutionLogs';
import { Terminal, ChevronDown, Filter, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

type FilterType = 'all' | 'errors' | 'actions' | 'thoughts';

export function MicromanagerView() {
  const { tasks, agents, selectedTaskId, selectTask } = useUIStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  // Get active tasks (assigned, in_progress, needs_human)
  const activeTasks = tasks.filter(t =>
    ['assigned', 'in_progress', 'needs_human'].includes(t.status)
  );

  const selectedTask = selectedTaskId
    ? tasks.find(t => t.id === selectedTaskId) ?? null
    : activeTasks[0] ?? null;

  const assignedAgent = selectedTask?.assignedAgentId
    ? agents.find(a => a.id === selectedTask.assignedAgentId) ?? null
    : null;

  // Use the WebSocket-powered execution logs hook
  const { logs, isLoading, getErrorsOnly, refresh } = useExecutionLogs(selectedTask?.id ?? null);

  // Apply filters
  const filteredLogs = useMemo(() => {
    switch (filter) {
      case 'errors':
        return getErrorsOnly();
      case 'actions':
        return logs.filter(log => log.type === 'action');
      case 'thoughts':
        return logs.filter(log => log.type === 'thought');
      default:
        return logs;
    }
  }, [logs, filter, getErrorsOnly]);

  // Format log for display with colors
  const formatLog = (log: typeof logs[0]) => {
    const text = log.text;
    switch (log.type) {
      case 'error':
      case 'loop':
        return <span className="text-hud-red">{text}</span>;
      case 'thought':
        return <span className="text-gray-400 italic">{text}</span>;
      case 'action':
        return <span className="text-hud-blue">{text}</span>;
      case 'result':
        return <span className="text-hud-green">{text}</span>;
      default:
        return text;
    }
  };

  const addLog = (message: string) => {
    // This is now handled by WebSocket, but keeping for compatibility
    console.log('[MicromanagerView] addLog:', message);
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Agent Control */}
      <div className="w-64 border-r border-command-border flex flex-col">
        <AgentOverride
          agent={assignedAgent}
          task={selectedTask}
          onLog={addLog}
        />
      </div>

      {/* Main Panel - Step View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Task Selector */}
        <div className="p-4 border-b border-command-border">
          <div className="flex items-center gap-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Active Task
            </label>
            <select
              value={selectedTask?.id || ''}
              onChange={(e) => selectTask(e.target.value || null)}
              className="flex-1 bg-command-bg border border-command-border rounded px-3 py-2 text-sm focus:outline-none focus:border-hud-blue"
            >
              <option value="">Select a task...</option>
              {activeTasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.status.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step-by-Step View */}
        <div className="flex-1 overflow-hidden">
          <StepView
            task={selectedTask}
            agent={assignedAgent}
            onLog={addLog}
          />
        </div>
      </div>

      {/* Right Panel - Real-time Execution Log */}
      <div className="w-96 border-l border-command-border flex flex-col bg-command-panel">
        {/* Header */}
        <div className="p-3 border-b border-command-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-hud-green" />
            <span className="font-display text-xs uppercase tracking-wider text-gray-400">
              Live Execution Log
            </span>
            {isLoading && <Loader2 className="w-3 h-3 text-hud-blue animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-command-accent transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded transition-colors ${
                autoScroll ? 'bg-hud-green/20 text-hud-green' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Auto-scroll"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-3 py-2 border-b border-command-border flex items-center gap-2">
          <Filter className="w-3 h-3 text-gray-500" />
          <div className="flex gap-1">
            {(['all', 'errors', 'actions', 'thoughts'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider transition-colors ${
                  filter === f
                    ? f === 'errors'
                      ? 'bg-hud-red/20 text-hud-red'
                      : 'bg-hud-green/20 text-hud-green'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {filter === 'errors' && filteredLogs.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-hud-red">
              <AlertTriangle className="w-3 h-3" />
              {filteredLogs.length}
            </span>
          )}
        </div>

        {/* Log Content */}
        <div
          className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-command-bg custom-scrollbar"
          ref={(el) => {
            if (el && autoScroll) {
              el.scrollTop = el.scrollHeight;
            }
          }}
        >
          {!selectedTask ? (
            <div className="text-gray-600 text-center py-8">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select a task to view logs</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-gray-600 text-center py-8">
              <p>{isLoading ? 'Loading...' : 'No logs yet'}</p>
              <p className="text-[10px] mt-1 text-gray-700">
                Waiting for execution steps...
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`py-1 border-b border-command-border/30 last:border-0 ${
                    log.type === 'loop' ? 'bg-hud-amber/10 -mx-3 px-3' : ''
                  }`}
                >
                  {formatLog(log)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-command-border flex items-center justify-between text-xs text-gray-500">
          <span>{filteredLogs.length} entries {filter !== 'all' && `(${filter})`}</span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${
              selectedTask?.status === 'in_progress' ? 'bg-hud-green animate-pulse' : 'bg-gray-600'
            }`} />
            {selectedTask?.status === 'in_progress' ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>
    </div>
  );
}
