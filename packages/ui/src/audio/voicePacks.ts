/**
 * RTS-style voice packs for agent events
 * Original TTS-generated military voice lines (no copyrighted game audio)
 * Voices: Tactical Ops (US male), Mission Control (US female), Field Command (UK male)
 */

export type VoiceEvent =
  | 'task_assigned'
  | 'task_in_progress'
  | 'task_milestone'
  | 'task_completed'
  | 'task_failed'
  | 'agent_stuck'
  | 'loop_detected'
  | 'opus_review'
  | 'decomposition';

export type AgentVoiceType = 'coder' | 'qa' | 'cto' | 'default';

export type VoicePackId = 'tactical' | 'mission-control' | 'field-command';

export interface VoiceLine {
  event: VoiceEvent;
  audioFile: string;
  text: string;
}

export interface VoicePack {
  id: VoicePackId;
  name: string;
  description: string;
  lines: Record<VoiceEvent, VoiceLine[]>;
}

/**
 * Tactical Ops voice pack (default) — US male, commanding
 */
export const tacticalVoicePack: VoicePack = {
  id: 'tactical',
  name: 'Tactical Ops',
  description: 'Commanding US military operator',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/tactical/acknowledged.wav', text: 'Acknowledged' },
      { event: 'task_assigned', audioFile: '/audio/tactical/standing-by.wav', text: 'Standing by for orders' },
      { event: 'task_assigned', audioFile: '/audio/tactical/ready-to-deploy.wav', text: 'Ready to deploy' },
      { event: 'task_assigned', audioFile: '/audio/tactical/orders-received.wav', text: 'Orders received' },
      { event: 'task_assigned', audioFile: '/audio/tactical/on-it.wav', text: 'On it, commander' },
      { event: 'task_assigned', audioFile: '/audio/tactical/locked-in.wav', text: 'Locked in' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/tactical/moving-out.wav', text: 'Moving out' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/operation-underway.wav', text: 'Operation underway' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/executing-now.wav', text: 'Executing now' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/engaging-target.wav', text: 'Engaging target' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/in-position.wav', text: 'In position' },
      { event: 'task_in_progress', audioFile: '/audio/tactical/proceeding.wav', text: 'Proceeding to objective' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/tactical/making-progress.wav', text: 'Making progress' },
      { event: 'task_milestone', audioFile: '/audio/tactical/halfway-there.wav', text: 'Halfway there' },
      { event: 'task_milestone', audioFile: '/audio/tactical/on-track.wav', text: 'On track, commander' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/tactical/mission-complete.wav', text: 'Mission complete' },
      { event: 'task_completed', audioFile: '/audio/tactical/objective-secured.wav', text: 'Objective secured' },
      { event: 'task_completed', audioFile: '/audio/tactical/target-neutralized.wav', text: 'Target neutralized' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/tactical/mission-failed.wav', text: 'Mission failed' },
      { event: 'task_failed', audioFile: '/audio/tactical/pulling-back.wav', text: 'Pulling back' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/tactical/requesting-backup.wav', text: 'Requesting backup' },
      { event: 'agent_stuck', audioFile: '/audio/tactical/need-assistance.wav', text: 'Need assistance' },
      { event: 'agent_stuck', audioFile: '/audio/tactical/pinned-down.wav', text: 'Pinned down' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/tactical/going-in-circles.wav', text: 'Going in circles' },
      { event: 'loop_detected', audioFile: '/audio/tactical/something-wrong.wav', text: "Something's not right" },
      { event: 'loop_detected', audioFile: '/audio/tactical/abort-abort.wav', text: 'Abort. Abort.' },
      { event: 'loop_detected', audioFile: '/audio/tactical/recalibrating.wav', text: 'Recalibrating' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/tactical/analyzing.wav', text: 'Analyzing' },
      { event: 'opus_review', audioFile: '/audio/tactical/running-diagnostics.wav', text: 'Running diagnostics' },
      { event: 'opus_review', audioFile: '/audio/tactical/checking-intel.wav', text: 'Checking intel' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/tactical/breaking-it-down.wav', text: 'Breaking it down' },
      { event: 'decomposition', audioFile: '/audio/tactical/planning-approach.wav', text: 'Planning approach' },
    ],
  },
};

/**
 * Mission Control voice pack — US female, professional
 */
export const missionControlVoicePack: VoicePack = {
  id: 'mission-control',
  name: 'Mission Control',
  description: 'Professional NASA-style mission controller',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/mission-control/assignment-confirmed.wav', text: 'Assignment confirmed' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/task-accepted.wav', text: 'Task accepted' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/ready-for-tasking.wav', text: 'Ready for tasking' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/copy-that.wav', text: 'Copy that' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/roger-that.wav', text: 'Roger that' },
      { event: 'task_assigned', audioFile: '/audio/mission-control/affirmative.wav', text: 'Affirmative' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/mission-control/commencing-operations.wav', text: 'Commencing operations' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/systems-nominal.wav', text: 'Systems nominal' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/on-approach.wav', text: 'On approach' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/telemetry-is-good.wav', text: 'Telemetry is good' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/all-systems-go.wav', text: 'All systems go' },
      { event: 'task_in_progress', audioFile: '/audio/mission-control/in-the-pipeline.wav', text: 'In the pipeline' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/mission-control/checkpoint-reached.wav', text: 'Checkpoint reached' },
      { event: 'task_milestone', audioFile: '/audio/mission-control/looking-good.wav', text: 'Looking good' },
      { event: 'task_milestone', audioFile: '/audio/mission-control/steady-progress.wav', text: 'Steady progress' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/mission-control/task-complete.wav', text: 'Task complete' },
      { event: 'task_completed', audioFile: '/audio/mission-control/well-done.wav', text: 'Well done' },
      { event: 'task_completed', audioFile: '/audio/mission-control/success-confirmed.wav', text: 'Success confirmed' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/mission-control/task-unsuccessful.wav', text: 'Task unsuccessful' },
      { event: 'task_failed', audioFile: '/audio/mission-control/negative-result.wav', text: 'Negative result' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/mission-control/anomaly-detected.wav', text: 'Anomaly detected' },
      { event: 'agent_stuck', audioFile: '/audio/mission-control/system-unresponsive.wav', text: 'System unresponsive' },
      { event: 'agent_stuck', audioFile: '/audio/mission-control/intervention-required.wav', text: 'Intervention required' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/mission-control/pattern-detected.wav', text: 'Repeating pattern detected' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/loop-identified.wav', text: 'Loop identified' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/cycle-detected.wav', text: 'Cycle detected' },
      { event: 'loop_detected', audioFile: '/audio/mission-control/breaking-loop.wav', text: 'Breaking the loop' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/mission-control/initiating-review.wav', text: 'Initiating review' },
      { event: 'opus_review', audioFile: '/audio/mission-control/quality-check.wav', text: 'Quality check in progress' },
      { event: 'opus_review', audioFile: '/audio/mission-control/scanning-output.wav', text: 'Scanning output' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/mission-control/decomposing-task.wav', text: 'Decomposing task' },
      { event: 'decomposition', audioFile: '/audio/mission-control/analyzing-structure.wav', text: 'Analyzing structure' },
    ],
  },
};

/**
 * Field Command voice pack — UK male, authoritative
 */
export const fieldCommandVoicePack: VoicePack = {
  id: 'field-command',
  name: 'Field Command',
  description: 'British field operations commander',
  lines: {
    task_assigned: [
      { event: 'task_assigned', audioFile: '/audio/field-command/understood.wav', text: 'Understood' },
      { event: 'task_assigned', audioFile: '/audio/field-command/right-away.wav', text: 'Right away' },
      { event: 'task_assigned', audioFile: '/audio/field-command/consider-it-done.wav', text: 'Consider it done' },
      { event: 'task_assigned', audioFile: '/audio/field-command/at-once.wav', text: 'At once' },
      { event: 'task_assigned', audioFile: '/audio/field-command/straight-away.wav', text: 'Straight away, sir' },
      { event: 'task_assigned', audioFile: '/audio/field-command/on-the-case.wav', text: 'On the case' },
    ],
    task_in_progress: [
      { event: 'task_in_progress', audioFile: '/audio/field-command/pressing-forward.wav', text: 'Pressing forward' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/boots-on-ground.wav', text: 'Boots on the ground' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/operational.wav', text: 'Operational' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/en-route.wav', text: 'En route' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/making-headway.wav', text: 'Making headway' },
      { event: 'task_in_progress', audioFile: '/audio/field-command/underway.wav', text: 'Underway' },
    ],
    task_milestone: [
      { event: 'task_milestone', audioFile: '/audio/field-command/solid-progress.wav', text: 'Solid progress' },
      { event: 'task_milestone', audioFile: '/audio/field-command/getting-there.wav', text: 'Getting there' },
      { event: 'task_milestone', audioFile: '/audio/field-command/phase-complete.wav', text: 'Phase complete' },
    ],
    task_completed: [
      { event: 'task_completed', audioFile: '/audio/field-command/job-done.wav', text: 'Job done' },
      { event: 'task_completed', audioFile: '/audio/field-command/mission-accomplished.wav', text: 'Mission accomplished' },
      { event: 'task_completed', audioFile: '/audio/field-command/all-clear.wav', text: 'All clear' },
    ],
    task_failed: [
      { event: 'task_failed', audioFile: '/audio/field-command/no-joy.wav', text: 'No joy' },
      { event: 'task_failed', audioFile: '/audio/field-command/falling-back.wav', text: 'Falling back' },
    ],
    agent_stuck: [
      { event: 'agent_stuck', audioFile: '/audio/field-command/bogged-down.wav', text: 'Bogged down' },
      { event: 'agent_stuck', audioFile: '/audio/field-command/need-reinforcements.wav', text: 'Need reinforcements' },
      { event: 'agent_stuck', audioFile: '/audio/field-command/taking-fire.wav', text: 'Taking fire' },
    ],
    loop_detected: [
      { event: 'loop_detected', audioFile: '/audio/field-command/deja-vu.wav', text: 'Bit of deja vu here' },
      { event: 'loop_detected', audioFile: '/audio/field-command/stuck-in-a-rut.wav', text: 'Stuck in a rut' },
      { event: 'loop_detected', audioFile: '/audio/field-command/not-again.wav', text: 'Not again' },
      { event: 'loop_detected', audioFile: '/audio/field-command/change-of-plan.wav', text: 'Change of plan' },
    ],
    opus_review: [
      { event: 'opus_review', audioFile: '/audio/field-command/under-review.wav', text: 'Under review' },
      { event: 'opus_review', audioFile: '/audio/field-command/inspecting.wav', text: 'Inspecting' },
      { event: 'opus_review', audioFile: '/audio/field-command/double-checking.wav', text: 'Double checking' },
    ],
    decomposition: [
      { event: 'decomposition', audioFile: '/audio/field-command/splitting-up.wav', text: 'Splitting it up' },
      { event: 'decomposition', audioFile: '/audio/field-command/dividing-forces.wav', text: 'Dividing forces' },
    ],
  },
};

/**
 * Voice pack registry
 */
export const voicePacks: Record<VoicePackId, VoicePack> = {
  'tactical': tacticalVoicePack,
  'mission-control': missionControlVoicePack,
  'field-command': fieldCommandVoicePack,
};

/**
 * Get voice pack by ID
 */
export function getVoicePack(packId: VoicePackId): VoicePack {
  return voicePacks[packId] || tacticalVoicePack;
}

/**
 * Get list of available voice packs
 */
export function getAvailableVoicePacks(): VoicePack[] {
  return Object.values(voicePacks);
}

/**
 * Legacy default voice pack (for backward compatibility)
 */
export const defaultVoicePack = tacticalVoicePack.lines;

/**
 * Agent-specific voice packs (can be customized per agent type)
 */
export const agentVoicePacks: Record<AgentVoiceType, Record<VoiceEvent, VoiceLine[]>> = {
  default: defaultVoicePack,
  coder: defaultVoicePack,
  qa: defaultVoicePack,
  cto: defaultVoicePack,
};

/**
 * Get random voice line for an event
 */
export function getVoiceLine(event: VoiceEvent, agentType: AgentVoiceType = 'default'): VoiceLine {
  const lines = agentVoicePacks[agentType][event];
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * Get random voice line from a specific pack
 */
export function getVoiceLineFromPack(packId: VoicePackId, event: VoiceEvent): VoiceLine {
  const pack = getVoicePack(packId);
  const lines = pack.lines[event];
  return lines[Math.floor(Math.random() * lines.length)];
}
