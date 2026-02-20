import { ReactNode } from 'react';
import clsx from 'clsx';

interface ResourceBarProps {
  label: string;
  icon: ReactNode;
  value: number;
  max: number;
  color: 'green' | 'blue' | 'amber' | 'red' | 'purple';
  format?: 'number' | 'time' | 'percent';
}

const colorClasses = {
  green: 'bg-hud-green',
  blue: 'bg-hud-blue',
  amber: 'bg-hud-amber',
  red: 'bg-hud-red',
  purple: 'bg-hud-purple',
};

const textColorClasses = {
  green: 'text-hud-green',
  blue: 'text-hud-blue',
  amber: 'text-hud-amber',
  red: 'text-hud-red',
  purple: 'text-hud-purple',
};

function formatValue(value: number, format: ResourceBarProps['format']): string {
  switch (format) {
    case 'time':
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return `${hours}h ${minutes}m`;
    case 'percent':
      return `${value}%`;
    default:
      return value.toLocaleString();
  }
}

export function ResourceBar({ label, icon, value, max, color, format = 'number' }: ResourceBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  // Determine color based on percentage for "danger" indicators
  let actualColor = color;
  if (color === 'green' && percentage < 25) {
    actualColor = 'red';
  } else if (color === 'green' && percentage < 50) {
    actualColor = 'amber';
  }

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className={clsx('shrink-0', textColorClasses[actualColor])}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500 uppercase tracking-wider font-display">
            {label}
          </span>
          <span className={clsx('font-mono', textColorClasses[actualColor])}>
            {formatValue(value, format)}
          </span>
        </div>
        <div className="resource-bar h-2 relative">
          <div
            className={clsx('resource-bar-fill', colorClasses[actualColor])}
            style={{ width: `${percentage}%` }}
          />
          {/* Segment markers */}
          <div className="absolute inset-0 flex">
            {[25, 50, 75].map(mark => (
              <div
                key={mark}
                className="h-full border-r border-command-bg/50"
                style={{ width: `${mark}%`, marginRight: `-${mark}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
