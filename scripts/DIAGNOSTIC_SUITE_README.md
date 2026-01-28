# Agent Diagnostic Suite

Comprehensive testing and diagnostic system for Agent Battle Command Center.

## Overview

This suite creates 10 progressive difficulty tasks (complexity 1-10), executes them sequentially, and generates a detailed diagnostic report analyzing:
- Local agent (Ollama) performance ceiling
- CTO agent (Claude) effectiveness
- Task routing accuracy
- Training data collection quality
- System optimizations needed

## Quick Start

```bash
# 1. Verify system is ready
node scripts/verify-system.js

# 2. Run complete diagnostic suite (30-60 minutes)
node scripts/run-diagnostic-suite.js

# 3. View results
cat scripts/diagnostic-data/DIAGNOSTIC_REPORT.md
```

## Scripts

### `verify-system.js`
Pre-flight checks to ensure system is ready:
- ✅ All API endpoints accessible
- ✅ Agents are idle
- ✅ CTO agent exists
- ✅ Clean task queue

**Usage:**
```bash
node scripts/verify-system.js
```

### `run-diagnostic-suite.js`
Master script that runs all phases:
1. Create 10 test tasks
2. Analyze routing recommendations
3. Execute tasks sequentially
4. Collect all data
5. Analyze results
6. Format markdown report

**Usage:**
```bash
node scripts/run-diagnostic-suite.js
```

### Individual Phase Scripts

#### Phase 1: `create-test-tasks.js`
Creates 10 tasks with varying complexity:
- Tasks 1-3: Simple (complexity ~1.5-4.0)
- Tasks 4-6: Medium (complexity ~5.5-7.0)
- Tasks 7-8: Complex (complexity ~8.5-9.0)
- Tasks 9-10: Very Complex (complexity ~9.5-10.0)

**Usage:**
```bash
node scripts/create-test-tasks.js
```

**Output:** `scripts/test-task-ids.json`

#### Phase 2: `analyze-routing.js`
Analyzes routing recommendations before execution:
- Shows which agent would be assigned
- Displays complexity scores
- Confidence levels

**Usage:**
```bash
node scripts/analyze-routing.js
```

**Output:** `scripts/pre-execution-routing.json`

#### Phase 3: `execute-tasks.js`
Executes all tasks sequentially:
- Uses smart routing (TaskRouter)
- Polls every 5 seconds
- Timeout after 15 minutes per task
- Logs progress in real-time

**Usage:**
```bash
node scripts/execute-tasks.js
```

**Output:** `scripts/execution-results.json`

#### Phase 4: `collect-data.js`
Collects all execution data:
- Task results
- Execution logs
- Training data
- Agent stats

**Usage:**
```bash
node scripts/collect-data.js
```

**Output:** `scripts/diagnostic-data/` directory

#### Phase 5: `analyze-results.js`
Analyzes collected data and generates report:
- Success rates by agent type
- Complexity analysis
- Routing accuracy
- Performance metrics
- Recommendations

**Usage:**
```bash
node scripts/analyze-results.js
```

**Output:** `scripts/diagnostic-data/DIAGNOSTIC_REPORT.json`

#### Phase 6: `format-report.js`
Formats JSON report as human-readable markdown

**Usage:**
```bash
node scripts/format-report.js
```

**Output:** `scripts/diagnostic-data/DIAGNOSTIC_REPORT.md`

## The 10 Test Tasks

### Task 1: Hello World (Complexity ~1.5)
Simple file creation with single function.
**Expected:** Local agent succeeds

### Task 2: Calculator Module (Complexity ~2.5)
Multiple functions in single file.
**Expected:** Local agent succeeds

### Task 3: String Utilities with Tests (Complexity ~4.0)
Multi-file creation + testing.
**Expected:** Local agent succeeds

### Task 4: Data Processing Pipeline (Complexity ~5.5)
File I/O, validation, error handling.
**Expected:** Local agent likely succeeds

### Task 5: REST API Client (Complexity ~6.5)
API client with mocking.
**Expected:** Local agent borderline

### Task 6: Database ORM Layer (Complexity ~7.0)
SQLite wrapper with CRUD operations.
**Expected:** CTO routing or local agent struggles

### Task 7: Multi-File Web Scraper (Complexity ~8.5)
Complex architecture with package structure.
**Expected:** CTO routes and succeeds

### Task 8: Async Task Queue (Complexity ~9.0)
Async programming with worker pool.
**Expected:** CTO routes and succeeds

### Task 9: Refactor Architecture (Complexity ~9.5)
Code analysis and refactoring.
**Expected:** CTO routes and succeeds

### Task 10: Code Review (Complexity ~10.0)
Full codebase review and analysis.
**Expected:** CTO routes and succeeds (review type)

## Expected Outcomes

### Best Case (90-100% success)
- Tasks 1-6: Local agent succeeds
- Tasks 7-10: CTO succeeds

### Realistic (70-89% success)
- Tasks 1-3: Local agent succeeds (100%)
- Tasks 4-6: Local agent partial (67%)
- Tasks 7-10: CTO succeeds (100%)

### Worst Case (60-69% success)
- Tasks 1-3: Local agent succeeds (100%)
- Tasks 4-6: Local agent struggles (33%)
- Tasks 7-10: CTO succeeds (75-100%)

## Interpreting Results

### Local Agent Performance

**Max Complexity Succeeded:**
- < 4.0: Agent needs improvement
- 4.0-6.0: Good for simple tasks
- 6.0-7.0: Excellent for local model
- > 7.0: Outstanding (unlikely with qwen2.5-coder:7b)

**Success Rate:**
- < 50%: Major issues
- 50-70%: Needs backstory improvements
- 70-85%: Good performance
- > 85%: Excellent

**Loop Detection:**
- 0-1 loops: Excellent
- 2-3 loops: Acceptable
- > 3 loops: Need better stop conditions

### CTO Agent Performance

**Success Rate:**
- < 90%: Check Claude API key
- 90-100%: Expected performance

### Training Data Quality

**Good Examples:**
- < 5: Need more data
- 5-10: Minimum viable
- 10-20: Good collection
- > 20: Ready for fine-tuning

**Avg Quality Score:**
- < 0.5: Poor data quality
- 0.5-0.7: Acceptable
- > 0.7: High quality

## Troubleshooting

### "Assignment failed" errors
```bash
# Reset all agents
curl -X POST http://localhost:3001/api/agents/reset-all
```

### Tasks timeout
- Increase `MAX_WAIT_MINUTES` in `execute-tasks.js`
- Check agent logs: `docker compose logs -f agents`

### CTO not routing correctly
- Verify `ANTHROPIC_API_KEY` is set
- Check `packages/api/src/services/taskRouter.ts` complexity thresholds

### No training data collected
- Check API logs: `docker compose logs api | grep "training"`
- Verify `TrainingDataService` is integrated in task completion

## Data Output Structure

```
scripts/
├── test-task-ids.json              # Created task IDs
├── pre-execution-routing.json      # Routing analysis
├── execution-results.json          # Execution summary
└── diagnostic-data/
    ├── post-execution-tasks.json   # Full task data
    ├── logs-<task-id>.json         # Execution logs (10 files)
    ├── training-data.json          # Training dataset
    ├── training-data-stats.json    # Training stats
    ├── post-execution-agents.json  # Agent status
    ├── DIAGNOSTIC_REPORT.json      # Analysis results
    └── DIAGNOSTIC_REPORT.md        # Human-readable report
```

## Cleanup

After reviewing results, clean up test data:

```bash
# Delete all test tasks (via UI or API)
# Or reset database:
docker compose down -v
docker compose up
docker compose exec api npx prisma db seed
```

## Cost Estimate

**Ollama (Local):** $0 - Free
**Claude (CTO):** ~$0.40 for 4 tasks
- Task 7: ~$0.10
- Task 8: ~$0.10
- Task 9: ~$0.10
- Task 10: ~$0.10

**Total:** ~$0.40 per diagnostic run

## Timeline

| Phase | Time | Activity |
|-------|------|----------|
| 0 | 2 min | Verify system |
| 1 | 1 min | Create tasks |
| 2 | 1 min | Analyze routing |
| 3 | 30-60 min | Execute tasks |
| 4 | 2 min | Collect data |
| 5 | 1 min | Analyze results |
| 6 | 1 min | Format report |
| **Total** | **~40-70 min** | End-to-end |

## Next Steps After Diagnostic

1. **Review report** - Identify local agent ceiling
2. **Adjust routing** - Update complexity thresholds in `TaskRouter.ts`
3. **Improve agents** - Update backstories based on failure patterns
4. **Collect more data** - Re-run failed tasks with CTO for comparison pairs
5. **Export training data** - Use `/api/training-data/export` for JSONL
6. **Fine-tune model** - Use collected data with OpenAI fine-tuning API

---

**Generated by Agent Battle Command Center Diagnostic Suite**
