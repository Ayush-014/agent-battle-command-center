/**
 * C&C Red Alert style voice packs for agent events
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

export interface VoiceLine {
  event: VoiceEvent;
  audioFile: string;
  text: string;
}

/**
 * Default voice pack - C&C Red Alert style (using actual user audio files)
 */
export const defaultVoicePack: Record<VoiceEvent, VoiceLine[]> = {
  task_assigned: [
    { event: 'task_assigned', audioFile: '/audio/aye-commander.mp3', text: 'Aye commander' },
    { event: 'task_assigned', audioFile: '/audio/conscript-reporting.mp3', text: 'Conscript reporting' },
    { event: 'task_assigned', audioFile: '/audio/acknowledged.mp3', text: 'Acknowledged' },
    { event: 'task_assigned', audioFile: '/audio/mission-sir.mp3', text: 'Mission sir' },
    { event: 'task_assigned', audioFile: '/audio/can-do.mp3', text: 'Can do' },
    { event: 'task_assigned', audioFile: '/audio/i-hear-and-obey.mp3', text: 'I hear and obey' },
  ],
  task_in_progress: [
    { event: 'task_in_progress', audioFile: '/audio/operation-underway.mp3', text: 'Operation underway' },
    { event: 'task_in_progress', audioFile: '/audio/main-engines-engaged.mp3', text: 'Main engines engaged' },
    { event: 'task_in_progress', audioFile: '/audio/course-set.mp3', text: 'Course set' },
    { event: 'task_in_progress', audioFile: '/audio/battle-stations.mp3', text: 'Battle stations' },
    { event: 'task_in_progress', audioFile: '/audio/engineering.mp3', text: 'Engineering' },
    { event: 'task_in_progress', audioFile: '/audio/closing-in.mp3', text: 'Closing in' },
  ],
  task_milestone: [
    { event: 'task_milestone', audioFile: '/audio/shake-it-baby.mp3', text: 'Shake it baby!' },
    { event: 'task_milestone', audioFile: '/audio/got-a-clear-view-sir.mp3', text: 'Got a clear view sir' },
    { event: 'task_milestone', audioFile: '/audio/checking-designs.mp3', text: 'Checking designs' },
  ],
  task_completed: [
    { event: 'task_completed', audioFile: '/audio/adios-amigos.mp3', text: 'Adios amigos' },
    { event: 'task_completed', audioFile: '/audio/already-there.mp3', text: 'Already there' },
    { event: 'task_completed', audioFile: '/audio/commander.mp3', text: 'Commander' },
  ],
  task_failed: [
    { event: 'task_failed', audioFile: '/audio/going-down.mp3', text: 'Going down' },
    { event: 'task_failed', audioFile: '/audio/but-i-was-working.mp3', text: 'But I was working' },
  ],
  agent_stuck: [
    { event: 'agent_stuck', audioFile: '/audio/eject-eject.mp3', text: 'Eject eject!' },
    { event: 'agent_stuck', audioFile: '/audio/changing-vector.mp3', text: 'Changing vector' },
    { event: 'agent_stuck', audioFile: '/audio/give-me-a-plan.mp3', text: 'Give me a plan' },
  ],
  loop_detected: [
    { event: 'loop_detected', audioFile: '/audio/i-knew-this-would-happen.mp3', text: 'I knew this would happen' },
    { event: 'loop_detected', audioFile: '/audio/are-you-kgb.mp3', text: 'Are you KGB?' },
    { event: 'loop_detected', audioFile: '/audio/checking-connection.mp3', text: 'Checking connection' },
    { event: 'loop_detected', audioFile: '/audio/da.mp3', text: 'Da' },
  ],
  opus_review: [
    { event: 'opus_review', audioFile: '/audio/checking-designs.mp3', text: 'Checking designs' },
    { event: 'opus_review', audioFile: '/audio/obtaining-intelligence.mp3', text: 'Obtaining intelligence' },
    { event: 'opus_review', audioFile: '/audio/analyzing-schematics.mp3', text: 'Analyzing schematics' },
  ],
  decomposition: [
    { event: 'decomposition', audioFile: '/audio/deconstructing.mp3', text: 'Deconstructing' },
    { event: 'decomposition', audioFile: '/audio/engineering.mp3', text: 'Engineering' },
  ],
};

/**
 * Agent-specific voice packs (can be customized per agent type)
 */
export const agentVoicePacks: Record<AgentVoiceType, Record<VoiceEvent, VoiceLine[]>> = {
  default: defaultVoicePack,
  coder: defaultVoicePack, // Can customize later
  qa: defaultVoicePack,    // Can customize later
  cto: defaultVoicePack,   // Can customize later
};

/**
 * Get random voice line for an event
 */
export function getVoiceLine(event: VoiceEvent, agentType: AgentVoiceType = 'default'): VoiceLine {
  const lines = agentVoicePacks[agentType][event];
  return lines[Math.floor(Math.random() * lines.length)];
}
