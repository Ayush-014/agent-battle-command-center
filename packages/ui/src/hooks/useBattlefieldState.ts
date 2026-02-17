import { useMemo, useRef } from 'react';
import { useUIStore } from '../store/uiState';
import {
  getBuildingTier,
  getAgentTier,
  hashTaskPosition,
  BUILDING_TIERS,
  type BattlefieldBuilding,
  type BattlefieldSquad,
} from '../components/battlefield/types';

const REPAIR_DURATION_MS = 1500;

/**
 * Derives 3D battlefield state from Zustand store.
 * Bridges the flat task/agent data to positioned 3D scene objects.
 */
export function useBattlefieldState() {
  const tasks = useUIStore((s) => s.tasks);
  const agents = useUIStore((s) => s.agents);

  // Track previous iteration counts to detect decreases (repair)
  const prevIterationsRef = useRef<Map<string, number>>(new Map());
  // Track active repair states
  const repairStateRef = useRef<Map<string, { fromDamage: number; startTime: number }>>(new Map());

  const hasActiveTasks = useMemo(
    () => tasks.some((t) => t.status === 'in_progress' || t.status === 'assigned'),
    [tasks],
  );

  const hasOllamaInProgress = useMemo(
    () =>
      tasks.some((t) => {
        if (t.status !== 'in_progress') return false;
        const agent = agents.find((a) => a.id === t.assignedAgentId);
        return agent?.type === 'coder';
      }),
    [tasks, agents],
  );

  // All non-completed tasks get buildings
  const visibleTasks = useMemo(
    () => tasks.filter((t) => !['completed', 'failed', 'aborted'].includes(t.status)),
    [tasks],
  );

  // Recently completed/failed tasks (for destruction animations) - last 10 seconds
  const recentlyFinished = useMemo(() => {
    const tenSecondsAgo = Date.now() - 10_000;
    return tasks.filter((t) => {
      if (!['completed', 'failed'].includes(t.status)) return false;
      const completedTime = t.completedAt ? new Date(t.completedAt).getTime() : 0;
      return completedTime > tenSecondsAgo;
    });
  }, [tasks]);

  // Build positioned building data
  const buildings: BattlefieldBuilding[] = useMemo(() => {
    const existingPositions: [number, number][] = [];
    const allTasks = [...visibleTasks, ...recentlyFinished];
    const now = Date.now();
    const prevIter = prevIterationsRef.current;
    const repairState = repairStateRef.current;

    // Clean up expired repair states
    for (const [taskId, state] of repairState) {
      if (now - state.startTime > REPAIR_DURATION_MS) {
        repairState.delete(taskId);
      }
    }

    const result = allTasks.map((task) => {
      const complexity = (task as any).complexity ?? task.priority ?? 5;
      const tier = getBuildingTier(complexity);
      const tierConfig = BUILDING_TIERS[tier];
      const [x, z] = hashTaskPosition(task.id, 30, tierConfig.scale * 2.5, existingPositions);
      existingPositions.push([x, z]);

      const assignedAgent = task.assignedAgentId
        ? agents.find((a) => a.id === task.assignedAgentId) ?? null
        : null;

      const maxIter = task.maxIterations || 10;
      const currentIter = task.currentIteration || 0;
      const damage = task.status === 'in_progress' ? Math.min(currentIter / maxIter, 1) : 0;

      // Detect iteration decrease → trigger repair
      const prevIterCount = prevIter.get(task.id) ?? 0;
      if (currentIter < prevIterCount && task.status === 'in_progress') {
        const prevDamage = Math.min(prevIterCount / maxIter, 1);
        repairState.set(task.id, { fromDamage: prevDamage, startTime: now });
      }
      prevIter.set(task.id, currentIter);

      // Check if currently repairing
      const activeRepair = repairState.get(task.id);
      const repairing = !!activeRepair && (now - activeRepair.startTime < REPAIR_DURATION_MS);

      return {
        taskId: task.id,
        task,
        tier,
        scale: tierConfig.scale,
        position: [x, 0, z] as [number, number, number],
        damage,
        underSiege: task.status === 'in_progress',
        assignedAgent,
        repairing,
        repairFromDamage: activeRepair?.fromDamage ?? 0,
        repairStartTime: activeRepair?.startTime ?? 0,
      };
    });

    return result;
  }, [visibleTasks, recentlyFinished, agents]);

  // Build squad data for agents with assigned tasks
  const squads: BattlefieldSquad[] = useMemo(() => {
    return buildings
      .filter((b) => b.assignedAgent && ['assigned', 'in_progress'].includes(b.task.status))
      .map((b) => {
        const agent = b.assignedAgent!;
        const tier = getAgentTier(agent);

        // Squad approaches from the edge toward the building
        const edgeX = b.position[0] > 0 ? 18 : -18;
        const edgeZ = b.position[2] > 0 ? 18 : -18;

        // Target position: 2 units from the building
        const dx = b.position[0] - edgeX;
        const dz = b.position[2] - edgeZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const stopDist = 2 * b.scale;
        const ratio = dist > 0 ? Math.max(0, (dist - stopDist) / dist) : 0;

        const targetX = edgeX + dx * ratio;
        const targetZ = edgeZ + dz * ratio;

        return {
          agentId: agent.id,
          agent,
          tier,
          targetTaskId: b.taskId,
          position: [edgeX, 0, edgeZ] as [number, number, number],
          targetPosition: [targetX, 0, targetZ] as [number, number, number],
          moveProgress: b.task.status === 'in_progress' ? 1 : 0,
          firing: b.task.status === 'in_progress',
        };
      });
  }, [buildings]);

  return {
    hasActiveTasks,
    hasOllamaInProgress,
    buildings,
    squads,
    visibleTasks,
    recentlyFinished,
  };
}
