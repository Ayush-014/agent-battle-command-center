"""Generate all 96 voice lines for 3 voice packs using Bark TTS.

Speaker 0, temp 0.8/0.8, flat radio static + opening squelch, max 2s.
5 second delay between clips to avoid GPU issues.
"""

import os
import time
import numpy as np
from scipy.io.wavfile import write as write_wav
from scipy.signal import butter, lfilter

os.environ["SUNO_USE_SMALL_MODELS"] = "0"

import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

from bark import SAMPLE_RATE, generate_audio, preload_models

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "packages", "ui", "public", "audio")

SPEAKER = "v2/en_speaker_0"
TEXT_TEMP = 0.8
WAVE_TEMP = 0.8
MAX_SECONDS = 2.0
REST_BETWEEN = 5  # seconds


def add_radio_effect(audio, sr):
    """Flat radio static + opening squelch click."""
    n = len(audio)
    nyq = sr / 2

    # Bandpass filter (300-3400 Hz)
    low, high = 300 / nyq, 3400 / nyq
    b, a = butter(4, [low, high], btype='band')
    filtered = lfilter(b, a, audio)

    # Light compression
    filtered = np.tanh(filtered * 2.0) * 0.7

    # Flat radio static
    noise = np.random.randn(n) * 0.04
    b_n, a_n = butter(2, [200 / nyq, 4000 / nyq], btype='band')
    static = lfilter(b_n, a_n, noise)

    # Opening squelch click (~30ms burst)
    squelch_len = int(sr * 0.03)
    squelch = np.random.randn(squelch_len) * 0.15
    squelch *= np.linspace(1, 0.3, squelch_len)
    squelch_padded = np.zeros(n)
    squelch_padded[:squelch_len] = squelch

    # Random crackle pops (mild)
    crackle = np.zeros(n)
    n_pops = np.random.randint(3, 8)
    for _ in range(n_pops):
        pos = np.random.randint(0, n)
        width = np.random.randint(5, 20)
        end = min(pos + width, n)
        crackle[pos:end] = np.random.randn(end - pos) * 0.06

    result = filtered + static + squelch_padded + crackle
    result = result / (np.max(np.abs(result)) + 1e-6) * 0.9
    return result


# ── Voice line definitions ──────────────────────────────────────────
# Format: (filename_without_ext, spoken_text)

TACTICAL = [
    # task_assigned
    ("acknowledged", "Acknowledged!"),
    ("standing-by", "Standing by for orders!"),
    ("ready-to-deploy", "Ready to deploy!"),
    ("orders-received", "Orders received!"),
    ("on-it", "On it, commander!"),
    ("locked-in", "Locked in!"),
    # task_in_progress
    ("moving-out", "Moving out!"),
    ("operation-underway", "Operation underway!"),
    ("executing-now", "Executing now!"),
    ("engaging-target", "Engaging target!"),
    ("in-position", "In position!"),
    ("proceeding", "Proceeding to objective!"),
    # task_milestone
    ("making-progress", "Making progress!"),
    ("halfway-there", "Halfway there!"),
    ("on-track", "On track, commander!"),
    # task_completed
    ("mission-complete", "Mission complete!"),
    ("objective-secured", "Objective secured!"),
    ("target-neutralized", "Target neutralized!"),
    # task_failed
    ("mission-failed", "Mission failed!"),
    ("pulling-back", "Pulling back!"),
    # agent_stuck
    ("requesting-backup", "Requesting backup!"),
    ("need-assistance", "Need assistance!"),
    ("pinned-down", "Pinned down!"),
    # loop_detected
    ("going-in-circles", "Going in circles!"),
    ("something-wrong", "Something's not right!"),
    ("abort-abort", "Abort! Abort!"),
    ("recalibrating", "Recalibrating!"),
    # opus_review
    ("analyzing", "Analyzing!"),
    ("running-diagnostics", "Running diagnostics!"),
    ("checking-intel", "Checking intel!"),
    # decomposition
    ("breaking-it-down", "Breaking it down!"),
    ("planning-approach", "Planning approach!"),
]

MISSION_CONTROL = [
    # task_assigned
    ("assignment-confirmed", "Assignment confirmed!"),
    ("task-accepted", "Task accepted!"),
    ("ready-for-tasking", "Ready for tasking!"),
    ("copy-that", "Copy that!"),
    ("roger-that", "Roger that!"),
    ("affirmative", "Affirmative!"),
    # task_in_progress
    ("commencing-operations", "Commencing operations!"),
    ("systems-nominal", "Systems nominal!"),
    ("on-approach", "On approach!"),
    ("telemetry-is-good", "Telemetry is good!"),
    ("all-systems-go", "All systems go!"),
    ("in-the-pipeline", "In the pipeline!"),
    # task_milestone
    ("checkpoint-reached", "Checkpoint reached!"),
    ("looking-good", "Looking good!"),
    ("steady-progress", "Steady progress!"),
    # task_completed
    ("task-complete", "Task complete!"),
    ("well-done", "Well done!"),
    ("success-confirmed", "Success confirmed!"),
    # task_failed
    ("task-unsuccessful", "Task unsuccessful!"),
    ("negative-result", "Negative result!"),
    # agent_stuck
    ("anomaly-detected", "Anomaly detected!"),
    ("system-unresponsive", "System unresponsive!"),
    ("intervention-required", "Intervention required!"),
    # loop_detected
    ("pattern-detected", "Repeating pattern detected!"),
    ("loop-identified", "Loop identified!"),
    ("cycle-detected", "Cycle detected!"),
    ("breaking-loop", "Breaking the loop!"),
    # opus_review
    ("initiating-review", "Initiating review!"),
    ("quality-check", "Quality check!"),
    ("scanning-output", "Scanning output!"),
    # decomposition
    ("decomposing-task", "Decomposing task!"),
    ("analyzing-structure", "Analyzing structure!"),
]

FIELD_COMMAND = [
    # task_assigned
    ("understood", "Understood!"),
    ("right-away", "Right away!"),
    ("consider-it-done", "Consider it done!"),
    ("at-once", "At once!"),
    ("straight-away", "Straight away, sir!"),
    ("on-the-case", "On the case!"),
    # task_in_progress
    ("pressing-forward", "Pressing forward!"),
    ("boots-on-ground", "Boots on the ground!"),
    ("operational", "Operational!"),
    ("en-route", "En route!"),
    ("making-headway", "Making headway!"),
    ("underway", "Underway!"),
    # task_milestone
    ("solid-progress", "Solid progress!"),
    ("getting-there", "Getting there!"),
    ("phase-complete", "Phase complete!"),
    # task_completed
    ("job-done", "Job done!"),
    ("mission-accomplished", "Mission accomplished!"),
    ("all-clear", "All clear!"),
    # task_failed
    ("no-joy", "No joy!"),
    ("falling-back", "Falling back!"),
    # agent_stuck
    ("bogged-down", "Bogged down!"),
    ("need-reinforcements", "Need reinforcements!"),
    ("taking-fire", "Taking fire!"),
    # loop_detected
    ("deja-vu", "Bit of deja vu here!"),
    ("stuck-in-a-rut", "Stuck in a rut!"),
    ("not-again", "Not again!"),
    ("change-of-plan", "Change of plan!"),
    # opus_review
    ("under-review", "Under review!"),
    ("inspecting", "Inspecting!"),
    ("double-checking", "Double checking!"),
    # decomposition
    ("splitting-up", "Splitting it up!"),
    ("dividing-forces", "Dividing forces!"),
]

PACKS = [
    ("tactical", TACTICAL),
    ("mission-control", MISSION_CONTROL),
    ("field-command", FIELD_COMMAND),
]


def generate_clip(text, filepath):
    """Generate a single voice clip with radio effect."""
    audio = generate_audio(
        text,
        history_prompt=SPEAKER,
        text_temp=TEXT_TEMP,
        waveform_temp=WAVE_TEMP,
    )
    max_samples = int(SAMPLE_RATE * MAX_SECONDS)
    audio = audio[:max_samples]
    audio = add_radio_effect(audio, SAMPLE_RATE)
    write_wav(filepath, SAMPLE_RATE, (audio * 32767).astype(np.int16))


if __name__ == "__main__":
    print("Loading Bark models to GPU...")
    preload_models()
    print("Ready!\n")

    total = sum(len(lines) for _, lines in PACKS)
    done = 0
    failed = []
    start_time = time.time()

    for pack_name, lines in PACKS:
        pack_dir = os.path.join(BASE_DIR, pack_name)
        os.makedirs(pack_dir, exist_ok=True)
        print(f"\n{'='*60}")
        print(f"  PACK: {pack_name} ({len(lines)} clips)")
        print(f"{'='*60}")

        for filename, text in lines:
            done += 1
            filepath = os.path.join(pack_dir, f"{filename}.wav")
            elapsed = time.time() - start_time
            eta = (elapsed / done) * (total - done) if done > 0 else 0
            print(f"\n  [{done}/{total}] {text}")
            print(f"    > {pack_name}/{filename}.wav  (ETA: {eta/60:.1f}m)")

            try:
                generate_clip(text, filepath)
                print(f"    OK")
            except Exception as e:
                print(f"    FAILED: {e}")
                failed.append((pack_name, filename, text, str(e)))

            if done < total:
                print(f"    Resting {REST_BETWEEN}s...")
                time.sleep(REST_BETWEEN)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  COMPLETE! {done - len(failed)}/{total} clips generated")
    print(f"  Time: {elapsed/60:.1f} minutes")
    print(f"  Output: {BASE_DIR}")
    if failed:
        print(f"\n  FAILURES ({len(failed)}):")
        for pack, fn, txt, err in failed:
            print(f"    - {pack}/{fn}: {err}")
    print(f"{'='*60}")
