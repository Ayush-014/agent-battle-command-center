# Next Session Plan — 2026-02-20

## Current Status
- **Score:** 8.7/10 Strong MVP
- **Python:** 90% (36/40) in 11 min
- **PHP:** 85% (17/20) in 4m 57s
- **JS/Go:** scripts exist, not recently benchmarked
- **Failure types:** syntax errors (unclosed parens, literal \n) + logic edge cases

---

## The Gate: Auto-Retry Pipeline → 100% Pass Rate

All current failures are trivially recoverable with error context. Build this first.

```
Task validation fails
    │
    ├─ Step 1: Syntax check per language
    │   ├─ PHP:    php -l tasks/file.php
    │   ├─ Python: python -m py_compile tasks/file.py
    │   ├─ JS:     node --check tasks/file.js
    │   ├─ Go:     go build tasks/file.go
    │   └─ TS:     tsc --noEmit tasks/file.ts
    │
    ├─ Step 2: Ollama retry WITH error message in context
    │   └─ "Your previous attempt failed with: <error>. Fix it."
    │
    └─ Step 3: Haiku fallback (full context: task + error + failed code)
        └─ Target: 100% across all languages
```

**Where to implement:** `packages/api/src/services/taskQueue.ts` or new `autoRetryService.ts`
**Estimated effort:** ~2 days

---

## After 100%: Build Real Things

`scripts/LANDING_PAGE_TEST_NOTES.md` already has early notes on this.

Graduation path:
1. **Landing page from a brief** — CTO decomposes → Coder builds HTML/CSS/JS → QA validates
2. **CLI tool** — multi-file, argument parsing, help text
3. **Simple REST API** — Express or FastAPI skeleton from a spec
4. **Full mini web app** — form, backend, database

---

## Quick Win: Measure tok/s (30 min)

Run when stack is up. Never been measured directly.

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-coder:8k",
  "prompt": "Write a Python function to reverse a string.",
  "stream": false
}' | jq '{
  tokens: .eval_count,
  duration_s: (.eval_duration / 1e9),
  tok_per_sec: (.eval_count / (.eval_duration / 1e9))
}'
```

Expected range: 60-90 tok/s (community benchmarks for RTX 3060 Ti + 7b Q4)

---

## Model Experiments (after tok/s baseline)

Worth trying IF qwen2.5-coder:7b plateaus:
- `deepseek-coder-v2:16b` — MoE, only 2.4B active params, may be fast on 8GB
- `qwen2.5-coder:14b-q2_K` — smaller quant, might fit better than q4
- `codellama:13b-instruct-q4_K_S` — older but code-tuned

**Caution:** qwen2.5-coder:7b is already 90%. New models are a gamble. Retry pipeline gives more ROI.

---

## Polish (do after the above, not before)

| Item | Effort | Notes |
|------|--------|-------|
| Run JS + Go 20-task benchmarks | 30 min | Get baseline scores |
| 3D UI enhancements | 2-3 days | `@react-three/postprocessing` already in node_modules |
| More languages (Rust, Java) | 1 day each | Add to shell.py security + agents container |
| Regenerate Bark voice lines | 21 min | Only if new events added |
| Dark mode | 1 day | CSS custom properties already in place |

---

## Priority Order

```
1. Measure tok/s              (stack up → one curl → 30 min)
2. Auto-retry pipeline        (~2 days → unlocks 100%)
3. First real project         (landing page from a brief)
4. JS + Go benchmarks         (30 min, housekeeping)
5. New model experiments      (only if needed)
6. UI polish / 3D / sounds    (fun, not urgent)
```

---

## Known TODOs in Code
- `coder-02` ghost agent still registered in DB — purge it (30 min)
- `api_credits_used: 0.1` hardcoded placeholder in cost tracking
- `os.environ` for request context in agents — not thread-safe
- Test coverage: resourcePool, rateLimiter, budgetService all at 0%

---

## Stack Startup
```bash
docker compose up
# Wait ~30s for Ollama models to load (8K/16K/32K auto-created by entrypoint)
# UI: http://localhost:5173
# API: http://localhost:3001
# Agents: http://localhost:8000
```
