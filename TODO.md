# Agent Battle Command Center - TODO & Future Enhancements

**Last Updated:** 2026-01-31

---

## 🚨 Critical Issues

### 1. Agent Execution Inefficiency - 47 File Writes for Simple Task

**Severity:** HIGH
**Priority:** P0
**Discovered:** 2026-01-31

**Issue:**
Agent made **47 file_write tool calls** to create 2 simple calculator functions (task bf4a337c).

**Impact:**
- Wasted ~130 API calls (47 writes + responses)
- Extended execution time from ~10s to several minutes
- Increased cost: ~$0.24 wasted per simple task
- Poor user experience (slow task completion)

**Evidence:**
```
Task: Create simple calculator (addv7.py)
- Files created: 2 (tasks/addv7.py, tests/test_addv7.py)
- File writes: 47 attempts
- Expected: 2-3 tool calls
- Actual: 47 tool calls (15x-23x overhead)
```

**Root Cause Investigation Needed:**
- [ ] Review execution logs for task bf4a337c
- [ ] Check for repeated errors/retries in agent loop
- [ ] Verify tool calling patterns
- [ ] Analyze agent prompt/instruction clarity
- [ ] Check for infinite loop detection issues

**Potential Fixes:**
1. **Improve loop detection** - `packages/agents/src/monitoring/action_history.py`
   - Current threshold may be too high
   - Add detection for repetitive identical tool calls

2. **Add early termination** - Stop after N failed attempts
   - Implement max retries per tool call
   - Add "stuck detection" heuristic

3. **Improve agent prompts** - Make instructions clearer
   - Add examples of correct tool usage
   - Emphasize "create file once, don't retry"

4. **Enable auto code review** - Catch issues earlier
   - Use Opus to review and suggest stopping early
   - Add quality gates before repeated attempts

**Related Files:**
- `packages/agents/src/monitoring/action_history.py` - Loop detection
- `packages/agents/src/monitoring/execution_logger.py` - Tool call logging
- `workspace/tasks/task-bf4a337c-create-simple-calculator.txt` - Evidence

**Success Criteria:**
- Simple tasks complete in ≤5 tool calls
- No more than 2x expected tool usage
- Loop detection triggers before 10 identical calls

---

## 🔧 Performance Optimizations

### 2. Queue-Based Task Execution (COMPLETED ✅)

**Status:** ✅ Completed 2026-01-31
**Result:** 21x throughput improvement

Successfully implemented queue-based task assignment:
- Eliminated wave delays
- Zero idle time for agents
- 95% success rate (19/20 tasks in 217s)

**File:** `scripts/load-test-20-tasks-queue.js`

---

## 📋 Code Quality Improvements

### 3. Test Quality Standards

**Priority:** P2

**Issues Identified:**
- Agents using incorrect pytest patterns (try/except instead of pytest.raises)
- Missing edge case testing (negative numbers, floats, etc.)
- No type hints in generated code
- Missing docstrings

**Action Items:**
- [ ] Create code quality guidelines document
- [ ] Add to agent system prompts
- [ ] Enable Opus auto-review for all code tasks
- [ ] Add pytest best practices to agent training

**Example Bad Pattern:**
```python
# Current (Wrong)
def test_divide():
    try:
        divide(10, 0)
    except ValueError as e:
        assert str(e) == 'Cannot divide by zero'

# Correct
def test_divide_by_zero():
    with pytest.raises(ValueError, match='Cannot divide by zero'):
        divide(10, 0)
```

---

## 🎯 Feature Requests

### 4. Real-Time Agent Monitoring Dashboard

**Priority:** P3

**Description:**
Add real-time visualization of agent activity during load tests:
- Tool call frequency graph
- Retry/loop detection alerts
- Live task progress per agent
- Resource utilization charts

**Potential Tools:**
- Grafana + Prometheus
- Custom React dashboard
- Terminal UI with blessed/ink

---

## 🧪 Testing & Validation

### 5. Automated Agent Performance Regression Tests

**Priority:** P2

**Description:**
Create automated tests to catch agent inefficiency:
- Max tool calls per task type
- Expected completion time benchmarks
- Success rate thresholds

**Implementation:**
- [ ] Add performance baselines to load tests
- [ ] Alert on >2x expected tool usage
- [ ] Track metrics over time (trend analysis)

---

## 📚 Documentation

### 6. Agent Behavior Guidelines

**Priority:** P2

**Documents Needed:**
- [ ] Agent best practices guide
- [ ] Tool usage patterns (dos/don'ts)
- [ ] Common pitfalls and solutions
- [ ] Debugging guide for stuck agents

---

## 🔮 Future Enhancements

### 7. Multi-Agent Collaboration (MCP)

**Status:** ✅ Infrastructure Complete
**Next Steps:**
- [ ] Create demo: Coder + QA working together
- [ ] Test file lock conflict resolution
- [ ] Validate real-time log streaming
- [ ] Production deployment with monitoring

**File:** `MCP_INTEGRATION_COMPLETE.md`

---

### 8. Cost Budget Alerts

**Priority:** P3

**Description:**
Add warnings when approaching token/cost limits:
- Daily budget tracking
- Per-task cost warnings
- Monthly projection alerts

---

### 9. Agent Performance History

**Priority:** P3

**Description:**
Time-series charts for agent performance trends:
- Success rate over time
- Average task completion time
- Cost per task trends
- Tool usage efficiency metrics

---

## 🐛 Known Issues

### 10. Test Discovery Failures

**Priority:** P1

**Issue:**
Pytest test discovery fails when tests are in wrong directories:
```
ModuleNotFoundError: No module named 'math_utils'
```

**Root Cause:**
Tests in `workspace/tasks/` instead of `workspace/tests/`

**Fix:**
- [ ] Update agent to always place tests in `workspace/tests/`
- [ ] Add validation step before pytest execution
- [ ] Update agent prompts with correct directory structure

---

## 📊 Metrics to Track

**Add to monitoring:**
- [ ] Tool calls per task (by complexity tier)
- [ ] Retry rate (failed tool calls / total calls)
- [ ] Loop detection trigger rate
- [ ] Average task completion time by tier
- [ ] Success rate by model (Ollama vs Claude)

---

## 🔄 Process Improvements

### 11. Pre-Commit Hooks for Agent Code

**Priority:** P2

**Description:**
Run automated checks on agent-generated code before marking tasks complete:
- [ ] Type checking (mypy)
- [ ] Linting (ruff/flake8)
- [ ] Test validation (pytest --collect-only)
- [ ] Code quality score

---

## 💡 Ideas for Exploration

- [ ] Fine-tune local Ollama model with training data
- [ ] A/B test different agent prompts
- [ ] Implement "agent health score" metric
- [ ] Add code review as default step (not just Opus)
- [ ] Create agent competition mode (benchmark models)

---

**Note:** Issues are prioritized as P0 (critical) → P1 (high) → P2 (medium) → P3 (low)
