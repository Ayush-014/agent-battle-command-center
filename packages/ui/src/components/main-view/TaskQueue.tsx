import { Plus, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import { TaskCard } from '../shared/TaskCard';
import { useUIStore } from '../../store/uiState';
import { CreateTaskModal } from './CreateTaskModal';

export function TaskQueue() {
  const { tasks } = useUIStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'coder' | 'qa'>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => ['completed', 'failed', 'aborted'].includes(t.status));

  const displayTasks = showCompleted ? completedTasks : pendingTasks;
  const filteredTasks = filter === 'all'
    ? displayTasks
    : displayTasks.filter(t => t.requiredAgent === filter || t.requiredAgent === null);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-sm uppercase tracking-wider text-gray-400">
            Task Queue
          </h2>
          <span className="text-xs text-gray-500">
            {showCompleted ? `${completedTasks.length} completed` : `${pendingTasks.length} pending`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Pending/Completed Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`p-1.5 rounded transition-colors ${
              showCompleted ? 'bg-hud-green/20 text-hud-green' : 'bg-command-accent text-gray-400'
            }`}
            title={showCompleted ? 'Show pending tasks' : 'Show completed tasks'}
          >
            {showCompleted ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </button>
          {/* Filter */}
          <div className="flex items-center gap-1 bg-command-accent rounded-lg p-1">
            {['all', 'coder', 'qa'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as typeof filter)}
                className={`px-2 py-1 text-xs rounded ${
                  filter === f
                    ? f === 'coder' ? 'bg-agent-coder/20 text-agent-coder'
                    : f === 'qa' ? 'bg-agent-qa/20 text-agent-qa'
                    : 'bg-command-panel text-white'
                    : 'text-gray-500'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {/* Add Task */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-1.5"
          >
            <Plus className="w-3 h-3 inline mr-1" />
            Add Task
          </button>
        </div>
      </div>

      {/* Task List - Full grid view */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <p>{showCompleted ? 'No completed tasks' : 'No pending tasks'}</p>
              {!showCompleted && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-hud-blue hover:underline"
                >
                  Create one
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {filteredTasks
              .sort((a, b) => b.priority - a.priority)
              .map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
