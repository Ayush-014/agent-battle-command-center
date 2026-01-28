import { create } from 'zustand';
import type { Task, Agent, Alert, UIMode } from '@abcc/shared';

interface UIState {
  // Mode
  mode: UIMode;
  setMode: (mode: UIMode) => void;

  // Selection
  selectedTaskId: string | null;
  selectedAgentId: string | null;
  selectTask: (id: string | null) => void;
  selectAgent: (id: string | null) => void;

  // UI toggles
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  alertsPanelOpen: boolean;
  toggleAlertsPanel: () => void;
  chatPanelOpen: boolean;
  toggleChatPanel: () => void;

  // Chat state
  activeChatAgentId: string | null;
  activeConversationId: string | null;
  setActiveChatAgent: (agentId: string | null) => void;
  setActiveConversation: (conversationId: string | null) => void;

  // Data
  tasks: Task[];
  agents: Agent[];
  alerts: Alert[];
  setTasks: (tasks: Task[]) => void;
  setAgents: (agents: Agent[]) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;

  // Real-time updates
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;
  updateAgent: (agent: Agent) => void;

  // Metrics
  metrics: {
    totalApiCredits: number;
    totalTimeMs: number;
    totalIterations: number;
  };
  setMetrics: (metrics: Partial<UIState['metrics']>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Mode
  mode: 'overseer',
  setMode: (mode) => set({ mode }),

  // Selection
  selectedTaskId: null,
  selectedAgentId: null,
  selectTask: (id) => set({ selectedTaskId: id }),
  selectAgent: (id) => set({ selectedAgentId: id }),

  // UI toggles
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  alertsPanelOpen: false,
  toggleAlertsPanel: () => set((state) => ({ alertsPanelOpen: !state.alertsPanelOpen })),
  chatPanelOpen: false,
  toggleChatPanel: () => set((state) => ({ chatPanelOpen: !state.chatPanelOpen })),

  // Chat state
  activeChatAgentId: null,
  activeConversationId: null,
  setActiveChatAgent: (agentId) => set({ activeChatAgentId: agentId }),
  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),

  // Data
  tasks: [],
  agents: [],
  alerts: [],
  setTasks: (tasks) => set({ tasks }),
  setAgents: (agents) => set({ agents }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50), // Keep last 50
      alertsPanelOpen: true,
    })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
    })),
  clearAlerts: () => set({ alerts: [] }),

  // Real-time updates
  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.some((t) => t.id === task.id)
        ? state.tasks.map((t) => (t.id === task.id ? task : t))
        : [...state.tasks, task],
    })),
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    })),
  updateAgent: (agent) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
    })),

  // Metrics
  metrics: {
    totalApiCredits: 0,
    totalTimeMs: 0,
    totalIterations: 0,
  },
  setMetrics: (metrics) =>
    set((state) => ({
      metrics: { ...state.metrics, ...metrics },
    })),
}));
