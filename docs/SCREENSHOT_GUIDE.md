# Screenshot Guide for README

This guide explains what screenshots to capture for the README to showcase the Agent Battle Command Center.

## Prerequisites

1. **Start the system**:
   ```bash
   docker compose up -d
   ```

2. **Open UI**: Navigate to http://localhost:5173

3. **Create some test tasks** to populate the UI:
   ```bash
   # Run a quick test to generate activity
   node scripts/test-parallel.js
   ```

4. **Screenshot tool recommendations**:
   - Windows: Snipping Tool (Win + Shift + S) or Greenshot
   - Mac: Cmd + Shift + 4
   - Linux: Flameshot or gnome-screenshot

---

## Screenshots to Capture

### 1. Command Center Overview
**File**: `docs/screenshots/command-center-overview.png`

**What to show**:
- Full browser window at http://localhost:5173
- Both "Overseer" and "Dashboard" modes visible in top bar
- Task queue (bounty board) with 4-6 tasks in various states
- Active missions strip showing 2-3 agents
- Tool log panel on the right showing recent activity
- Minimap in the sidebar

**Setup**:
- Make sure you're in "Overseer" mode (toggle at top)
- Have a mix of pending, in_progress, and completed tasks
- At least one agent should be actively working

**Tips**:
- Zoom browser to 90-100% for best fit
- Capture the entire UI including the top bar
- Make sure the teal/amber HUD colors are visible

---

### 2. Task Queue (Bounty Board)
**File**: `docs/screenshots/task-queue.png`

**What to show**:
- Main panel focused on the task queue grid
- 6-8 task cards visible
- Mix of complexities (C1-C8 colored badges)
- Different statuses (pending=gray, in_progress=blue, completed=green, failed=red)
- Priority indicators (high priority tasks highlighted)

**Setup**:
- Create diverse tasks with different complexities:
  ```bash
  # Use the UI "New Task" button or API
  curl -X POST http://localhost:3001/api/tasks \
    -H "X-API-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"title": "Create REST API", "description": "Build Express API with CRUD endpoints", "taskType": "code"}'
  ```

**Focus area**: Scroll to show the task cards clearly

---

### 3. Active Missions & Agent Health
**File**: `docs/screenshots/active-missions.png`

**What to show**:
- The horizontal agent status strip (below task queue)
- 3-4 agents with health indicators
- At least one agent in "busy" state (amber glow)
- Progress bars showing task completion
- Agent names and current task titles

**Setup**:
- Have 1-2 tasks actively executing
- Agents should show different states:
  - Green (idle)
  - Amber/yellow (busy/working)
  - Optionally red (stuck) if you can trigger it

**Tips**:
- Capture when agents are actually working (not all idle)
- Make sure the health indicator lights are visible

---

### 4. Tool Log (Terminal Feed)
**File**: `docs/screenshots/tool-log.png`

**What to show**:
- Right sidebar panel showing the tool log
- 5-8 log entries with different action types:
  - file_write (green)
  - shell_run (blue)
  - Errors (red)
- Syntax highlighting visible
- Expandable entries (click one to expand and show full details)

**Setup**:
- Have tasks running to generate log entries
- Expand one log entry to show the full input/output
- Scroll to show a variety of actions

**Tips**:
- Capture when there's active logging (during task execution)
- Include both collapsed and expanded log entries

---

### 5. Dashboard & Analytics
**File**: `docs/screenshots/dashboard.png`

**What to show**:
- Switch to "Dashboard" mode (toggle at top)
- Success rate charts by complexity
- Agent comparison cards showing:
  - Tasks completed
  - Success rate
  - Avg time
- Cost breakdown pie chart (by model tier)

**Setup**:
- After running several tasks, switch to Dashboard mode
- Make sure charts have data (run test scripts first)
- Scroll to show the key metrics

**Tips**:
- Dashboard looks best with at least 10-20 completed tasks
- Charts should show varied data (not all zeros)

---

### 6. Cost Tracking
**File**: `docs/screenshots/cost-dashboard.png`

**What to show**:
- Cost Dashboard panel (in Dashboard mode)
- Daily budget progress bar
- Model tier breakdown (Ollama=FREE, Haiku, Sonnet, Opus)
- Cost timeline chart
- Token burn rate indicator

**Setup**:
- Run tasks that use different model tiers:
  ```bash
  # Mix of Ollama and Claude tasks
  node scripts/test-parallel.js
  ```
- Navigate to Dashboard → Cost section

**Tips**:
- Cost tracking looks best after running paid Claude tasks
- Show the budget warnings if close to limit

---

## Image Specifications

**Format**: PNG (preferred) or JPG
**Resolution**: 1920x1080 or higher
**File size**: Keep under 500KB (optimize with tinypng.com if needed)
**Color**: Full color (don't grayscale - the teal/amber theme is important!)

---

## After Capturing Screenshots

1. **Save to** `docs/screenshots/` directory
2. **Verify** all 6 screenshots are present:
   ```bash
   ls docs/screenshots/
   # Should show:
   # command-center-overview.png
   # task-queue.png
   # active-missions.png
   # tool-log.png
   # dashboard.png
   # cost-dashboard.png
   ```

3. **Optimize images** (optional but recommended):
   ```bash
   # Use tinypng.com or imageoptim
   # Keep quality high but reduce file size
   ```

4. **Commit screenshots**:
   ```bash
   git add docs/screenshots/*.png
   git commit -m "Add README screenshots

   - Command center overview with task queue and active missions
   - Tool log showing real-time agent actions
   - Dashboard with analytics and cost tracking
   - All screenshots showcase C&C Red Alert-inspired UI

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

---

## Tips for Great Screenshots

✅ **Do:**
- Capture when tasks are actively running (shows the real-time aspect)
- Include varied task states (pending, in_progress, completed)
- Show the teal/amber HUD colors prominently
- Capture at 100% browser zoom for clarity
- Make sure text is readable

❌ **Don't:**
- Capture empty states (no tasks, no agents)
- Include sensitive data (API keys, passwords)
- Grayscale or heavily filter images
- Capture at awkward zoom levels (<90% or >110%)
- Include browser dev tools or console

---

## Optional: Create a GIF/Video

For extra wow factor, consider creating a short GIF showing:
- Creating a task
- Watching it get assigned and executed
- Tool log updating in real-time
- Task completing successfully

**Tools**:
- ScreenToGif (Windows)
- LICEcap (Mac/Windows)
- Peek (Linux)

**Save as**: `docs/screenshots/demo.gif` (keep under 5MB)

---

**Questions?** Check the UI in person - if it looks good to you, it'll look good in the README! 🎮
