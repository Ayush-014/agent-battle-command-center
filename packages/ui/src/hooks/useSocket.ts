import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUIStore } from '../store/uiState';
import type { Task, Agent, Alert, ExecutionStep, ChatStreamChunk, ChatStreamComplete, ChatError } from '@abcc/shared';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { updateTask, removeTask, updateAgent, addAlert } = useUIStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Task events
    socket.on('task_created', (event: { payload: Task }) => {
      console.log('Task created:', event.payload);
      updateTask(event.payload);
    });

    socket.on('task_updated', (event: { payload: Task }) => {
      console.log('Task updated:', event.payload);
      updateTask(event.payload);
    });

    socket.on('task_deleted', (event: { payload: { id: string } }) => {
      console.log('Task deleted:', event.payload.id);
      removeTask(event.payload.id);
    });

    // Agent events
    socket.on('agent_status_changed', (event: { payload: Agent }) => {
      console.log('Agent status changed:', event.payload);
      updateAgent(event.payload);
    });

    // Execution events
    socket.on('execution_step', (event: { payload: ExecutionStep }) => {
      console.log('Execution step:', event.payload);
      // Could add to a separate execution steps store
    });

    // Alert events
    socket.on('alert', (event: { payload: Alert }) => {
      console.log('Alert:', event.payload);
      addAlert(event.payload);
    });

    // Chat events - delegate to chat handlers if available
    socket.on('chat_message_chunk', (event: { payload: ChatStreamChunk }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamChunk: (data: ChatStreamChunk) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamChunk) {
        handlers.handleStreamChunk(event.payload);
      }
    });

    socket.on('chat_message_complete', (event: { payload: ChatStreamComplete }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamComplete: (data: ChatStreamComplete) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamComplete) {
        handlers.handleStreamComplete(event.payload);
      }
    });

    socket.on('chat_error', (event: { payload: ChatError }) => {
      const handlers = (window as unknown as { chatHandlers?: {
        handleStreamError: (data: ChatError) => void;
      } }).chatHandlers;
      if (handlers?.handleStreamError) {
        handlers.handleStreamError(event.payload);
      }
    });

    socketRef.current = socket;
  }, [updateTask, removeTask, updateAgent, addAlert]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    emit,
    isConnected,
    socket: socketRef.current,
  };
}
