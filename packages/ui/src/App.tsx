import { useEffect } from 'react';
import { CommandCenter } from './components/layout/CommandCenter';
import { useSocket } from './hooks/useSocket';
import { useAgents } from './hooks/useAgents';
import { useTasks } from './hooks/useTasks';

function App() {
  const { connect, disconnect, isConnected } = useSocket();
  const { fetchAgents } = useAgents();
  const { fetchTasks } = useTasks();

  useEffect(() => {
    connect();
    fetchAgents();
    fetchTasks();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, fetchAgents, fetchTasks]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <CommandCenter />
      {!isConnected && (
        <div className="fixed bottom-4 right-4 bg-hud-amber/20 border border-hud-amber/50 text-hud-amber px-4 py-2 rounded-lg text-sm">
          Connecting to server...
        </div>
      )}
    </div>
  );
}

export default App;
