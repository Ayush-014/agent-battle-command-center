import { useState, useEffect, useCallback } from 'react';
import { StepView } from './StepView';
import { AgentOverride } from './AgentOverride';
import { ExecutionLog } from './ExecutionLog';
import { useUIStore } from '../../store/uiState';
import { executionLogsApi, type ExecutionLog as ApiExecutionLog } from '../../api/client';

export function MicromanagerView() {
  const { tasks, agents, selectedTaskId, selectTask } = useUIStore();
  const [logs, setLogs] = useState<string[]>([]);
  const [lastLogCount, setLastLogCount] = useState(0);

  // Format execution log to display string
  const formatExecutionLog = useCallback((log: ApiExecutionLog): string[] => {
    const lines: string[] = [];
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false });

    if (log.thought) {
      lines.push(`${time} [💭 Thought] ${log.thought.substring(0, 100)}${log.thought.length > 100 ? '...' : ''}`);
    }

    const inputStr = typeof log.actionInput === 'string'
      ? log.actionInput
      : JSON.stringify(log.actionInput).substring(0, 50);
    lines.push(`${time} [⚡ ${log.action}] ${inputStr}`);

    const obsPreview = log.observation.substring(0, 80);
    if (log.observation.includes('SUCCESS') || log.observation.includes('✓')) {
      lines.push(`${time} ✓ ${obsPreview}`);
    } else if (log.observation.includes('Error') || log.observation.includes('failed')) {
      lines.push(`${time} ✗ ${obsPreview}`);
    } else {
      lines.push(`${time} → ${obsPreview}`);
    }

    if (log.isLoop) {
      lines.push(`${time} ⚠️ Loop detected!`);
    }

    return lines;
  }, []);

  // Poll for execution logs when a task is selected
  useEffect(() => {
    if (!selectedTaskId) {
      setLogs(['Waiting for task selection...']);
      return;
    }

    const fetchLogs = async () => {
      try {
        const execLogs = await executionLogsApi.getTaskLogs(selectedTaskId);
        if (execLogs.length !== lastLogCount) {
          setLastLogCount(execLogs.length);
          const formattedLogs = execLogs.flatMap(formatExecutionLog);
          setLogs(formattedLogs.length > 0 ? formattedLogs : ['No execution logs yet...']);
        }
      } catch (error) {
        // Silent fail - task might not have logs yet
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [selectedTaskId, lastLogCount, formatExecutionLog]);

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

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, `${timestamp} ${message}`].slice(-100));
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

      {/* Right Panel - Execution Log */}
      <div className="w-80 border-l border-command-border">
        <ExecutionLog logs={logs} />
      </div>
    </div>
  );
}
