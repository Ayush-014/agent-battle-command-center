import { User, Bot } from 'lucide-react';
import type { ChatRole } from '@abcc/shared';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

export function ChatMessage({ role, content, isStreaming, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-hud-blue/20' : 'bg-hud-green/20'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-hud-blue" />
        ) : (
          <Bot className="w-4 h-4 text-hud-green" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-hud-blue/20 border border-hud-blue/30'
            : 'bg-command-accent border border-command-border'
        }`}
      >
        <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-hud-green animate-pulse" />
          )}
        </div>
        {timestamp && (
          <div className="text-xs text-gray-500 mt-1">
            {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
