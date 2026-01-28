import { useEffect, useRef, useState } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';

interface ExecutionLogProps {
  logs: string[];
}

export function ExecutionLog({ logs }: ExecutionLogProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      // Consider "at bottom" if within 50px
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const formatLog = (log: string) => {
    // Highlight different types of logs
    if (log.includes('Error') || log.includes('✗')) {
      return <span className="text-hud-red">{log}</span>;
    }
    if (log.includes('✓') || log.includes('approved') || log.includes('completed')) {
      return <span className="text-hud-green">{log}</span>;
    }
    if (log.includes('⏸️') || log.includes('Waiting')) {
      return <span className="text-hud-amber">{log}</span>;
    }
    if (log.includes('Executing') || log.includes('Step')) {
      return <span className="text-hud-blue">{log}</span>;
    }
    return log;
  };

  return (
    <div className="h-full flex flex-col bg-command-panel">
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="font-display text-xs uppercase tracking-wider text-gray-400">
            Execution Log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(true)}
            className={`p-1 rounded transition-colors ${
              autoScroll ? 'bg-hud-green/20 text-hud-green' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Auto-scroll"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-command-bg"
      >
        {logs.length === 0 ? (
          <div className="text-gray-600 text-center py-4">
            No logs yet
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className="py-0.5 border-b border-command-border/30 last:border-0"
              >
                {formatLog(log)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-command-border flex items-center justify-between text-xs text-gray-500">
        <span>{logs.length} entries</span>
        {!autoScroll && (
          <span className="text-hud-amber">
            Auto-scroll paused
          </span>
        )}
      </div>
    </div>
  );
}
