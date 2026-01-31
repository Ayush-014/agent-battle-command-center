# Phase: MCP Agent Collaboration & Context Sharing

> Implementation plan for enhanced agent collaboration using MCP infrastructure

## Overview

Transform the MCP gateway from a file-locking system into a full collaboration platform with:
- Cross-task memory and learning
- Architectural context injection
- Tiered code review system
- Optimized tier routing

## Summary of Changes

### Tier Routing (Updated)

| Complexity | Model | Agent | Cost |
|------------|-------|-------|------|
| 1-4 | Ollama (qwen2.5-coder:7b) | coder-01 | FREE |
| 5-8 | Haiku | qa-01 | ~$0.001/task |
| 9-10 | Sonnet | qa-01 | ~$0.005/task |
| Decomposition (9+) | Opus | cto-01 | ~$0.04/task |
| Code Review | Opus/Haiku | cto-01/qa-01 | varies |

### Code Review Schedule

| Review Type | Frequency | Reviewer | Trigger |
|-------------|-----------|----------|---------|
| Ollama tasks | Every 5th task | Haiku | Cheap quality gate |
| All tasks (complexity > 5) | Every 10th task | Opus | Deep review |

### Failed Review Criteria

Task fails review if ANY of:
- Quality score < 6
- Any "critical" severity finding
- Syntax errors detected

### Escalation Path

```
Ollama fails/bad review → Haiku retries with context
Haiku fails/bad review → Human escalation
Sonnet fails/bad review → Human escalation
```

---

## Implementation Phases

### Phase 1: Tier Routing Updates
**Estimated effort: Small**

Update `packages/api/src/services/taskRouter.ts`:

```typescript
// OLD thresholds
const OLLAMA_MAX = 3;    // → 4
const HAIKU_MAX = 7;     // → 8
const SONNET_MAX = 8;    // → 10 (Sonnet only for 9-10)
const OPUS_DECOMPOSE = 8; // → 9

// NEW thresholds
const TIER_THRESHOLDS = {
  OLLAMA: { min: 1, max: 4 },
  HAIKU: { min: 5, max: 8 },
  SONNET: { min: 9, max: 10 },
  OPUS_DECOMPOSE: 9  // Only decompose at 9+
};
```

**Files to modify:**
- `packages/api/src/services/taskRouter.ts`
- `packages/api/src/services/taskQueue.ts` (if thresholds duplicated)

---

### Phase 2: Enable MCP Permanently
**Estimated effort: Small**

1. Update `docker-compose.yml`:
```yaml
api:
  environment:
    USE_MCP: "true"  # Changed from ${USE_MCP:-false}

agents:
  environment:
    USE_MCP: "true"  # Changed from ${USE_MCP:-false}
```

2. Update `.env.example` to document the change

**Files to modify:**
- `docker-compose.yml`
- `.env.example`

---

### Phase 3: Tiered Review System
**Estimated effort: Medium**

#### 3.1 Review Scheduler

Add review scheduling logic to `packages/api/src/services/taskQueue.ts`:

```typescript
interface ReviewSchedule {
  ollamaReviewCounter: number;  // Reset at 5
  allTaskReviewCounter: number; // Reset at 10
}

function shouldReviewTask(task: Task, counters: ReviewSchedule): ReviewDecision {
  // Haiku reviews every 5th Ollama task
  if (task.executedByModel === 'ollama' && counters.ollamaReviewCounter >= 5) {
    return { shouldReview: true, reviewer: 'haiku' };
  }

  // Opus reviews every 10th task with complexity > 5
  if (task.finalComplexity > 5 && counters.allTaskReviewCounter >= 10) {
    return { shouldReview: true, reviewer: 'opus' };
  }

  return { shouldReview: false };
}
```

#### 3.2 Review Failure Handler

```typescript
interface ReviewResult {
  passed: boolean;
  qualityScore: number;
  hasCritical: boolean;
  hasSyntaxErrors: boolean;
}

function handleReviewFailure(task: Task, review: ReviewResult): void {
  const failed = review.qualityScore < 6 ||
                 review.hasCritical ||
                 review.hasSyntaxErrors;

  if (failed) {
    // Add review context to MCP
    await mcpClient.addTaskContext(task.id, {
      type: 'failed_review',
      qualityScore: review.qualityScore,
      findings: review.findings,
      previousModel: task.executedByModel
    });

    // Escalate to next tier
    const nextTier = getEscalationTier(task.executedByModel);
    if (nextTier === 'human') {
      task.status = 'needs_human_review';
    } else {
      task.status = 'pending';
      task.preferredModel = nextTier;
    }
  }
}

function getEscalationTier(currentModel: string): string {
  switch (currentModel) {
    case 'ollama': return 'haiku';
    case 'haiku': return 'human';
    case 'sonnet': return 'human';
    default: return 'human';
  }
}
```

**Files to modify:**
- `packages/api/src/services/taskQueue.ts`
- `packages/api/src/services/codeReviewService.ts` (new or existing)
- `packages/api/prisma/schema.prisma` (add review counters to Task)

---

### Phase 4: Cross-Task Memory System
**Estimated effort: Large**

#### 4.1 Database Schema

Add to `packages/api/prisma/schema.prisma`:

```prisma
model TaskMemory {
  id            String   @id @default(uuid())
  taskType      String   // file_creation, bug_fix, refactor, test, etc.
  pattern       String   // What was learned
  solution      String   // How it was solved
  errorPattern  String?  // If from error resolution
  filePatterns  String[] // Files typically involved
  successCount  Int      @default(1)  // How often this worked
  lastUsed      DateTime @default(now())
  createdAt     DateTime @default(now())
  approved      Boolean  @default(false)  // Human approval

  @@index([taskType])
  @@index([approved])
}
```

#### 4.2 MCP Memory Resource

Add to `packages/mcp-gateway/src/resources/memory.py`:

```python
class MemoryResource:
    """Cross-task memory access for agents"""

    async def get_relevant_memories(
        self,
        task_type: str,
        keywords: list[str],
        limit: int = 5
    ) -> list[dict]:
        """Get approved memories relevant to current task"""
        # Check Redis cache first
        cache_key = f"memory:{task_type}:{hash(tuple(keywords))}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Query PostgreSQL for approved memories
        memories = await self.postgres.query("""
            SELECT pattern, solution, error_pattern, success_count
            FROM task_memory
            WHERE task_type = $1
              AND approved = true
            ORDER BY success_count DESC, last_used DESC
            LIMIT $2
        """, task_type, limit)

        # Cache in Redis (1 hour TTL)
        await self.redis.setex(cache_key, 3600, json.dumps(memories))
        return memories

    async def propose_memory(
        self,
        task_id: str,
        agent_id: str,
        memory: dict
    ) -> dict:
        """Agent proposes a new memory (requires human approval)"""
        return await self.postgres.insert("task_memory", {
            **memory,
            "approved": False,
            "proposed_by_task": task_id,
            "proposed_by_agent": agent_id
        })
```

#### 4.3 MCP Memory Tools

Add to `packages/agents/src/tools/mcp_memory.py`:

```python
@tool("recall_similar_solutions")
def recall_similar_solutions(task_type: str, keywords: str) -> str:
    """
    Recall solutions from similar past tasks.

    Args:
        task_type: Type of task (file_creation, bug_fix, refactor, test)
        keywords: Comma-separated keywords describing the problem

    Returns:
        JSON with relevant past solutions and patterns
    """
    client = MCPClient()
    memories = client.get_memories(task_type, keywords.split(","))
    return json.dumps(memories, indent=2)

@tool("learn_from_success")
def learn_from_success(
    task_type: str,
    pattern: str,
    solution: str,
    error_pattern: str = ""
) -> str:
    """
    Propose a learning from successful task completion.
    Will be reviewed by human before becoming available to other agents.

    Args:
        task_type: Type of task
        pattern: What problem pattern was encountered
        solution: How it was solved
        error_pattern: If this fixed an error, what was the error
    """
    client = MCPClient()
    result = client.propose_memory({
        "task_type": task_type,
        "pattern": pattern,
        "solution": solution,
        "error_pattern": error_pattern
    })
    return f"Learning proposed (ID: {result['id']}). Awaiting human approval."
```

**Files to create/modify:**
- `packages/api/prisma/schema.prisma`
- `packages/mcp-gateway/src/resources/memory.py` (new)
- `packages/mcp-gateway/src/tools/memory.py` (new)
- `packages/agents/src/tools/mcp_memory.py` (new)
- `packages/agents/src/agents/base.py` (add memory tools)
- `packages/api/src/routes/memories.ts` (new - for human approval UI)

---

### Phase 5: Architectural Context System
**Estimated effort: Medium**

#### 5.1 Context Generator Script

Create `scripts/generate-arch-context.js`:

```javascript
/**
 * Generates architectural context from codebase analysis.
 * Output stored in MCP for agent reference.
 */

async function generateArchContext() {
  const context = {
    generated_at: new Date().toISOString(),

    // Project structure
    structure: await analyzeProjectStructure(),

    // Coding standards (from existing code patterns)
    standards: await extractCodingStandards(),

    // API conventions
    api_conventions: await analyzeAPIPatterns(),

    // Testing requirements
    testing: await analyzeTestPatterns()
  };

  // Store in MCP
  await mcpClient.setArchContext(context);

  // Also save locally for human review
  await fs.writeFile(
    'workspace/arch-context.json',
    JSON.stringify(context, null, 2)
  );
}

async function analyzeProjectStructure() {
  return {
    packages: ['api', 'agents', 'ui', 'mcp-gateway', 'backup'],
    conventions: {
      api_routes: 'packages/api/src/routes/*.ts',
      agent_tools: 'packages/agents/src/tools/*.py',
      ui_components: 'packages/ui/src/components/**/*.tsx',
      task_workspace: 'workspace/tasks/'
    }
  };
}

async function extractCodingStandards() {
  return {
    typescript: {
      style: 'Use async/await over callbacks',
      imports: 'Use .js extensions for local imports',
      exports: 'Named exports preferred over default'
    },
    python: {
      style: 'Type hints required for function parameters',
      tools: 'Use @tool decorator from crewai_tools',
      returns: 'Return JSON strings from tools'
    }
  };
}
```

#### 5.2 MCP Architecture Resource

Add to `packages/mcp-gateway/src/resources/architecture.py`:

```python
class ArchitectureResource:
    """Provides architectural context to agents"""

    URI = "architecture://context"

    async def get_context(self) -> dict:
        """Get current architectural context"""
        # Try Redis cache first
        cached = await self.redis.get("arch:context")
        if cached:
            return json.loads(cached)

        # Fall back to PostgreSQL
        context = await self.postgres.get_arch_context()
        if context:
            await self.redis.setex("arch:context", 3600, json.dumps(context))
        return context

    async def get_section(self, section: str) -> dict:
        """Get specific section (structure, standards, api, testing)"""
        context = await self.get_context()
        return context.get(section, {})
```

#### 5.3 Agent Tool for Context Access

Add to `packages/agents/src/tools/mcp_context.py`:

```python
@tool("get_project_context")
def get_project_context(section: str = "all") -> str:
    """
    Get architectural context for the project.

    Args:
        section: One of: structure, standards, api_conventions, testing, or 'all'

    Returns:
        JSON with project conventions and patterns
    """
    client = MCPClient()
    if section == "all":
        context = client.get_arch_context()
    else:
        context = client.get_arch_section(section)
    return json.dumps(context, indent=2)
```

**Files to create/modify:**
- `scripts/generate-arch-context.js` (new)
- `packages/mcp-gateway/src/resources/architecture.py` (new)
- `packages/agents/src/tools/mcp_context.py` (new)
- `packages/agents/src/agents/base.py` (add context tool)

---

### Phase 6: Review Context Injection
**Estimated effort: Small**

When a task fails review, inject context into MCP so the next agent knows what went wrong.

Add to `packages/mcp-gateway/src/tools/review_context.py`:

```python
@tool("get_previous_attempt")
def get_previous_attempt(task_id: str) -> str:
    """
    Get context from previous failed attempt on this task.

    Returns:
        JSON with previous code, review findings, and what to fix
    """
    client = MCPClient()
    context = client.get_task_review_context(task_id)
    if not context:
        return json.dumps({"previous_attempts": 0})

    return json.dumps({
        "previous_attempts": context["attempt_count"],
        "last_review": {
            "quality_score": context["quality_score"],
            "critical_findings": context["critical_findings"],
            "syntax_errors": context["syntax_errors"],
            "suggestions": context["suggestions"]
        },
        "previous_code": context["previous_code"]
    }, indent=2)
```

**Files to create/modify:**
- `packages/mcp-gateway/src/tools/review_context.py` (new)
- `packages/agents/src/tools/mcp_review.py` (new)
- `packages/api/src/services/taskQueue.ts` (inject context on failure)

---

### Phase 7: Human Approval UI
**Estimated effort: Medium**

Add UI for approving agent-proposed memories.

#### 7.1 API Endpoints

Add `packages/api/src/routes/memories.ts`:

```typescript
// GET /api/memories/pending - List unapproved memories
// POST /api/memories/:id/approve - Approve a memory
// POST /api/memories/:id/reject - Reject a memory
// GET /api/memories/approved - List approved memories
```

#### 7.2 UI Component

Add `packages/ui/src/components/memories/MemoryApproval.tsx`:

```tsx
export function MemoryApproval() {
  const { data: pending } = useQuery(['memories', 'pending']);

  return (
    <div className="memory-approval">
      <h2>Pending Agent Learnings</h2>
      {pending?.map(memory => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          onApprove={() => approveMutation.mutate(memory.id)}
          onReject={() => rejectMutation.mutate(memory.id)}
        />
      ))}
    </div>
  );
}
```

**Files to create:**
- `packages/api/src/routes/memories.ts`
- `packages/ui/src/components/memories/MemoryApproval.tsx`
- `packages/ui/src/components/memories/MemoryCard.tsx`

---

## Implementation Order

```
Phase 1: Tier Routing Updates ────────────────────► Day 1
    │
    ▼
Phase 2: Enable MCP Permanently ──────────────────► Day 1
    │
    ▼
Phase 3: Tiered Review System ────────────────────► Days 2-3
    │
    ▼
Phase 4: Cross-Task Memory System ────────────────► Days 4-6
    │
    ▼
Phase 5: Architectural Context System ────────────► Days 7-8
    │
    ▼
Phase 6: Review Context Injection ────────────────► Day 9
    │
    ▼
Phase 7: Human Approval UI ───────────────────────► Days 10-11
```

---

## Testing Checkpoints

### After Phase 1-2
```bash
# Verify tier routing
curl http://localhost:3001/api/queue/test-task-id/route
# Should show updated thresholds

# Verify MCP enabled
docker exec abcc-agents env | grep USE_MCP
# Should show USE_MCP=true
```

### After Phase 3
```bash
# Run 10 Ollama tasks, verify 2 get Haiku review
node scripts/test-review-schedule.js

# Verify escalation
# Create task that will fail review, confirm it escalates
```

### After Phase 4
```bash
# Verify memory storage
curl http://localhost:3001/api/memories/pending

# Verify agent can recall
# Check agent logs for recall_similar_solutions calls
```

### After Phase 5
```bash
# Generate context
node scripts/generate-arch-context.js

# Verify agent access
# Check agent logs for get_project_context calls
```

---

## Configuration Summary

### Environment Variables (Final)

```bash
# docker-compose.yml
USE_MCP=true
MCP_GATEWAY_URL=http://mcp-gateway:8001

# Review scheduling
OLLAMA_REVIEW_INTERVAL=5      # Haiku reviews every 5th Ollama task
OPUS_REVIEW_INTERVAL=10       # Opus reviews every 10th task (complexity > 5)
REVIEW_QUALITY_THRESHOLD=6    # Fail if score < 6

# Memory
MEMORY_CACHE_TTL=3600         # 1 hour Redis cache
```

### Database Migrations

```bash
# After schema changes
cd packages/api
npx prisma migrate dev --name add_task_memory
npx prisma generate
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Ollama task success rate | > 95% (with Haiku review backup) |
| Average cost per task | < $0.01 (heavy Ollama usage) |
| Human escalations | < 5% of tasks |
| Memory utilization | > 50% of tasks recall relevant memories |
| Review coverage | 100% of high-complexity tasks |

---

## Rollback Plan

Each phase can be rolled back independently:

1. **Tier routing**: Revert thresholds in taskRouter.ts
2. **MCP enabled**: Set USE_MCP=false in docker-compose.yml
3. **Review system**: Disable review scheduling (set intervals to 0)
4. **Memory system**: Feature flag `ENABLE_MEMORY=false`
5. **Arch context**: Remove tools from agent configs
6. **Review context**: Skip context injection in taskQueue.ts
7. **Approval UI**: Hide UI component

---

## Next Steps After This Phase

1. **Semantic memory search** - Add embeddings for better memory recall
2. **Agent capability registry** - Agents know what other agents can do
3. **Automated context updates** - CI/CD triggers context regeneration
4. **Memory analytics** - Track which memories are most useful
5. **Multi-agent collaboration** - Agents working on same task together
