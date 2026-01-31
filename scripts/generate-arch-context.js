#!/usr/bin/env node
/**
 * Architectural Context Generator
 *
 * Analyzes the codebase and generates architectural context for agents.
 * Output is stored in the database and cached in Redis via MCP.
 *
 * Usage:
 *   node scripts/generate-arch-context.js
 *   node scripts/generate-arch-context.js --output workspace/arch-context.json
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Patterns to analyze
const PATTERNS = {
  api_routes: 'packages/api/src/routes/*.ts',
  api_services: 'packages/api/src/services/*.ts',
  agent_tools: 'packages/agents/src/tools/*.py',
  agent_agents: 'packages/agents/src/agents/*.py',
  ui_components: 'packages/ui/src/components/**/*.tsx',
  mcp_resources: 'packages/mcp-gateway/src/resources/*.py',
  mcp_tools: 'packages/mcp-gateway/src/tools/*.py',
};

// Coding standards extracted from CLAUDE.md
const CODING_STANDARDS = {
  typescript: {
    style: 'Use async/await over callbacks',
    imports: 'Use .js extensions for local imports',
    exports: 'Named exports preferred over default',
    errorHandling: 'Use asyncHandler wrapper for route handlers',
    types: 'Use Prisma types where available',
  },
  python: {
    style: 'Type hints required for function parameters',
    tools: 'Use @tool decorator from crewai_tools',
    returns: 'Return JSON strings from tools',
    async: 'Use asyncio for async operations',
    logging: 'Use logging module, not print',
  },
};

// API conventions
const API_CONVENTIONS = {
  endpoints: {
    tasks: '/api/tasks - CRUD for tasks',
    agents: '/api/agents - Agent management',
    queue: '/api/queue - Task routing and assignment',
    execute: '/api/execute - Task execution',
    memories: '/api/memories - Cross-task learning',
    codeReviews: '/api/code-reviews - Code review management',
  },
  responses: {
    success: '{ data: T } or direct T for GET',
    error: '{ error: string, details?: object }',
    pagination: '{ items: T[], total: number, limit: number, offset: number }',
  },
  errorCodes: {
    400: 'Bad request - validation failed',
    404: 'Resource not found',
    409: 'Conflict - resource locked or state invalid',
    500: 'Internal server error',
  },
};

// Testing requirements
const TESTING_REQUIREMENTS = {
  taskValidation: 'Each task must have a validationCommand',
  fileCreation: 'New files go in workspace/tasks/{task_id}/',
  pythonTesting: 'Use python3 -c "..." for validation',
  cleanup: 'Tasks should clean up test files on completion',
};

async function analyzeProjectStructure() {
  const structure = {
    packages: [],
    conventions: {},
  };

  const packagesDir = path.join(PROJECT_ROOT, 'packages');
  if (fs.existsSync(packagesDir)) {
    structure.packages = fs.readdirSync(packagesDir)
      .filter(f => fs.statSync(path.join(packagesDir, f)).isDirectory());
  }

  // Map file patterns
  for (const [name, pattern] of Object.entries(PATTERNS)) {
    structure.conventions[name] = pattern;
  }

  return structure;
}

async function generateContext() {
  console.log('Generating architectural context...\n');

  const structure = await analyzeProjectStructure();

  const context = {
    generated_at: new Date().toISOString(),
    version: '1.0.0',

    // Project structure
    structure: {
      packages: structure.packages,
      filePatterns: structure.conventions,
      workspaceLayout: {
        tasks: 'workspace/tasks/ - Active task files',
        tests: 'workspace/tests/ - Test files',
        archives: {
          tasks: 'workspace/tasks_archive/ - Completed task files',
          tests: 'workspace/tests_archive/ - Completed test files',
        },
      },
    },

    // Coding standards
    standards: CODING_STANDARDS,

    // API conventions
    api: API_CONVENTIONS,

    // Testing
    testing: TESTING_REQUIREMENTS,

    // Tier routing (current)
    routing: {
      tiers: {
        ollama: { complexity: '1-4', cost: 'FREE', agent: 'coder-01' },
        haiku: { complexity: '5-8', cost: '~$0.001/task', agent: 'qa-01' },
        sonnet: { complexity: '9-10', cost: '~$0.005/task', agent: 'qa-01' },
        opus: { role: 'Decomposition (9+) and code reviews only', cost: '~$0.04/task', agent: 'cto-01' },
      },
      escalation: 'Ollama → Haiku → Human',
      reviews: {
        haiku: 'Every 5th Ollama task',
        opus: 'Every 10th task (complexity > 5)',
      },
    },

    // Agent roles
    agents: {
      'coder-01': {
        type: 'coder',
        model: 'ollama/qwen2.5-coder:7b',
        capabilities: ['file_read', 'file_write', 'file_edit', 'shell_run'],
        focus: 'Simple coding tasks (complexity 1-4)',
      },
      'qa-01': {
        type: 'qa',
        model: 'haiku/sonnet (based on complexity)',
        capabilities: ['file_read', 'file_write', 'shell_run', 'code_search'],
        focus: 'Quality-focused coding (complexity 5-10)',
      },
      'cto-01': {
        type: 'cto',
        model: 'opus',
        capabilities: ['review_code', 'create_subtask', 'assign_task', 'escalate_task'],
        focus: 'Task decomposition and code review (NO file_write)',
      },
    },
  };

  return context;
}

async function saveContext(context, outputPath) {
  // Save to file
  const outputFile = outputPath || path.join(PROJECT_ROOT, 'workspace', 'arch-context.json');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(context, null, 2));
  console.log(`Context saved to: ${outputFile}`);

  // Also try to store in API
  try {
    const response = await fetch(`${API_BASE}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskType: 'architecture',
        pattern: 'Project architectural context',
        solution: JSON.stringify(context),
        keywords: ['architecture', 'context', 'structure', 'standards'],
      }),
    });

    if (response.ok) {
      const memory = await response.json();
      console.log(`Context stored in memories API: ${memory.id}`);

      // Auto-approve architectural context
      await fetch(`${API_BASE}/api/memories/${memory.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'system' }),
      });
      console.log('Context auto-approved');
    }
  } catch (error) {
    console.warn('Could not store in API (API may not be running):', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
    }
  }

  const context = await generateContext();
  await saveContext(context, outputPath);

  console.log('\nArchitectural context generated successfully!');
  console.log('\nSummary:');
  console.log(`  - Packages: ${context.structure.packages.join(', ')}`);
  console.log(`  - Standards: TypeScript, Python`);
  console.log(`  - API endpoints: ${Object.keys(context.api.endpoints).length}`);
  console.log(`  - Agent roles: ${Object.keys(context.agents).length}`);
}

main().catch(console.error);
