import clsx from 'clsx';
import type { TaskStatus, AgentStatus } from '@abcc/shared';

const taskStatusConfig: Record<TaskStatus, { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'bg-status-pending/20 text-status-pending' },
  assigned: { label: 'Assigned', class: 'bg-status-assigned/20 text-status-assigned' },
  in_progress: { label: 'In Progress', class: 'bg-status-active/20 text-status-active' },
  needs_human: { label: 'Needs Human', class: 'bg-status-stuck/20 text-status-stuck' },
  completed: { label: 'Completed', class: 'bg-status-completed/20 text-status-completed' },
  failed: { label: 'Failed', class: 'bg-status-failed/20 text-status-failed' },
  aborted: { label: 'Aborted', class: 'bg-status-pending/20 text-status-pending' },
};

const agentStatusConfig: Record<AgentStatus, { label: string; class: string }> = {
  idle: { label: 'Idle', class: 'bg-status-completed/20 text-status-completed' },
  busy: { label: 'Busy', class: 'bg-status-active/20 text-status-active' },
  stuck: { label: 'Stuck', class: 'bg-status-stuck/20 text-status-stuck' },
  offline: { label: 'Offline', class: 'bg-status-pending/20 text-status-pending' },
};

interface StatusBadgeProps {
  status: TaskStatus | AgentStatus;
  type?: 'task' | 'agent';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, type = 'task', size = 'md' }: StatusBadgeProps) {
  const config = type === 'task'
    ? taskStatusConfig[status as TaskStatus]
    : agentStatusConfig[status as AgentStatus];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-display uppercase tracking-wider',
        config.class,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      )}
    >
      {config.label}
    </span>
  );
}
