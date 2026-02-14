"""Quick Bark TTS test - find the best military voice speaker."""

import os
import numpy as np
from scipy.io.wavfile import write as write_wav

# Use GPU, full-size models for quality
os.environ["SUNO_USE_SMALL_MODELS"] = "0"

# Monkey-patch torch.load for Bark compatibility (PyTorch 2.6+ changed defaults)
import torch
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

from bark import SAMPLE_RATE, generate_audio, preload_models

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "bark-test-output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Loading Bark models to GPU...")
preload_models()
print("Models loaded!\n")

# Short, punchy military phrases - Bark works best with these
TEST_PHRASES = [
    "ACKNOWLEDGED! Orders received, moving out!",
    "Mission COMPLETE. Objective secured.",
    "ABORT! ABORT! Going in circles!",
]

# Test a few speakers - deep male voices for military
SPEAKERS = ["v2/en_speaker_0", "v2/en_speaker_3", "v2/en_speaker_6"]

for speaker in SPEAKERS:
    tag = speaker.split("_")[-1]
    for i, phrase in enumerate(TEST_PHRASES):
        filename = f"s{tag}_t{i+1}.wav"
        filepath = os.path.join(OUTPUT_DIR, filename)
        print(f"[speaker_{tag}] {phrase[:45]}...")
        audio = generate_audio(phrase, history_prompt=speaker)
        write_wav(filepath, SAMPLE_RATE, (audio * 32767).astype(np.int16))

print(f"\nDone! Files in: {OUTPUT_DIR}")
print("Open them and pick the best speaker!")
