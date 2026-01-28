import { useCallback, useState, useRef } from 'react';
import { chatApi } from '../api/client';
import type { Conversation, ChatMessage } from '@abcc/shared';

interface StreamingMessage {
  messageId: string;
  content: string;
  isStreaming: boolean;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamingContentRef = useRef<string>('');

  const fetchConversations = useCallback(async (agentId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await chatApi.listConversations(agentId);
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await chatApi.getConversation(id);
      setActiveConversation(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (
    agentId: string,
    taskId?: string,
    title?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const conversation = await chatApi.createConversation({ agentId, taskId, title });
      setConversations(prev => [conversation, ...prev]);
      setActiveConversation(conversation);
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await chatApi.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeConversation]);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    setError(null);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date(),
    };

    setActiveConversation(prev => {
      if (!prev || prev.id !== conversationId) return prev;
      return {
        ...prev,
        messages: [...prev.messages, userMessage],
      };
    });

    // Reset streaming state
    streamingContentRef.current = '';
    setStreamingMessage({
      messageId: '',
      content: '',
      isStreaming: true,
    });

    try {
      await chatApi.sendMessage(conversationId, content);
      // Response will come via WebSocket
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setStreamingMessage(null);
      throw err;
    }
  }, []);

  // Handle streaming chunk from WebSocket
  const handleStreamChunk = useCallback((data: {
    conversationId: string;
    messageId: string;
    chunk: string;
  }) => {
    if (activeConversation?.id !== data.conversationId) return;

    streamingContentRef.current += data.chunk;

    setStreamingMessage({
      messageId: data.messageId,
      content: streamingContentRef.current,
      isStreaming: true,
    });
  }, [activeConversation]);

  // Handle stream complete from WebSocket
  const handleStreamComplete = useCallback((data: {
    conversationId: string;
    messageId: string;
    fullContent: string;
  }) => {
    if (activeConversation?.id !== data.conversationId) return;

    // Add the complete message to conversation
    const assistantMessage: ChatMessage = {
      id: data.messageId,
      conversationId: data.conversationId,
      role: 'assistant',
      content: data.fullContent,
      createdAt: new Date(),
    };

    setActiveConversation(prev => {
      if (!prev || prev.id !== data.conversationId) return prev;
      return {
        ...prev,
        messages: [...prev.messages, assistantMessage],
      };
    });

    // Clear streaming state
    streamingContentRef.current = '';
    setStreamingMessage(null);
  }, [activeConversation]);

  // Handle error from WebSocket
  const handleStreamError = useCallback((data: {
    conversationId: string;
    error: string;
  }) => {
    if (activeConversation?.id !== data.conversationId) return;

    setError(data.error);
    streamingContentRef.current = '';
    setStreamingMessage(null);
  }, [activeConversation]);

  const selectConversation = useCallback((conversation: Conversation | null) => {
    setActiveConversation(conversation);
    streamingContentRef.current = '';
    setStreamingMessage(null);
  }, []);

  return {
    conversations,
    activeConversation,
    streamingMessage,
    loading,
    error,
    fetchConversations,
    fetchConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    selectConversation,
    handleStreamChunk,
    handleStreamComplete,
    handleStreamError,
  };
}
