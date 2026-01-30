#!/usr/bin/env node

/**
 * Quick 8-Task Mixed Test Suite
 * - 5 simple tasks (priority 3) → Ollama
 * - 3 complex tasks (priority 5) → Haiku
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';

// Simple task template (Ollama tier)
function makeSimpleTask(funcName, code, testCode, fileName) {
  return {
    title: `Create ${funcName} function`,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/${fileName}.py with this exact content:
${code}

Step 2: Verify the file was created successfully.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.py", content="...")`,
    expectedOutput: `File tasks/${fileName}.py created with ${funcName} function`,
    validation: `python -c "${testCode}"`,
    priority: 3,  // Ollama tier
    tier: 'ollama'
  };
}

// Complex task template (Haiku tier)
function makeComplexTask(title, description, expectedOutput, validation, fileName) {
  return {
    title,
    description,
    expectedOutput,
    validation,
    priority: 5,  // Haiku tier
    tier: 'haiku',
    fileName
  };
}

const tasks = [
  // === OLLAMA TIER (5 simple tasks) ===
  makeSimpleTask("greet", "def greet(name):\\n    return f'Hello, {name}!'",
    "from tasks.greet import greet; assert greet('World')=='Hello, World!'; print('PASS')", "greet"),
  makeSimpleTask("add", "def add(a, b):\\n    return a + b",
    "from tasks.add import add; assert add(2,3)==5; print('PASS')", "add"),
  makeSimpleTask("multiply", "def multiply(a, b):\\n    return a * b",
    "from tasks.multiply import multiply; assert multiply(3,4)==12; print('PASS')", "multiply"),
  makeSimpleTask("reverse_string", "def reverse_string(s):\\n    return s[::-1]",
    "from tasks.reverse_string import reverse_string; assert reverse_string('hello')=='olleh'; print('PASS')", "reverse_string"),
  makeSimpleTask("find_max", "def find_max(numbers):\\n    return max(numbers)",
    "from tasks.find_max import find_max; assert find_max([3,1,4,1,5])==5; print('PASS')", "find_max"),

  // === HAIKU TIER (3 complex tasks) ===
  makeComplexTask(
    "Create FizzBuzz function with edge cases",
    `Create a Python function fizzbuzz(n) that implements FizzBuzz with proper handling:
- For multiples of 3, return "Fizz"
- For multiples of 5, return "Buzz"
- For multiples of both 3 and 5, return "FizzBuzz"
- For other numbers, return the number as a string
- Handle edge cases: n=0 should return "FizzBuzz", negative numbers work the same way

Save to tasks/fizzbuzz.py

The function should handle:
1. Regular numbers (1, 2, 4, 7, etc.) → return str(n)
2. Multiples of 3 only (3, 6, 9, etc.) → "Fizz"
3. Multiples of 5 only (5, 10, 20, etc.) → "Buzz"
4. Multiples of both (15, 30, 0, etc.) → "FizzBuzz"
5. Negative numbers (-3, -5, -15, etc.) → same rules apply`,
    "FizzBuzz function with edge case handling",
    `python -c "from tasks.fizzbuzz import fizzbuzz; assert fizzbuzz(1)=='1'; assert fizzbuzz(3)=='Fizz'; assert fizzbuzz(5)=='Buzz'; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(0)=='FizzBuzz'; assert fizzbuzz(-3)=='Fizz'; print('PASS')"`,
    "fizzbuzz"
  ),

  makeComplexTask(
    "Create palindrome checker with normalization",
    `Create a Python function is_palindrome(s) that checks if a string is a palindrome:

Requirements:
1. Ignore case (treat 'A' same as 'a')
2. Ignore spaces and punctuation (only consider alphanumeric characters)
3. Return True if palindrome, False otherwise
4. Handle empty string (return True)
5. Handle single character (return True)

Examples:
- is_palindrome("racecar") → True
- is_palindrome("Race Car") → True
- is_palindrome("A man, a plan, a canal: Panama") → True
- is_palindrome("hello") → False
- is_palindrome("") → True

Save to tasks/palindrome.py`,
    "Palindrome checker with case/punctuation handling",
    `python -c "from tasks.palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('Race Car')==True; assert is_palindrome('A man, a plan, a canal: Panama')==True; assert is_palindrome('hello')==False; assert is_palindrome('')==True; assert is_palindrome('a')==True; print('PASS')"`,
    "palindrome"
  ),

  makeComplexTask(
    "Create word frequency counter",
    `Create a Python function word_frequency(text) that counts word occurrences:

Requirements:
1. Split text into words (by whitespace)
2. Convert words to lowercase for counting
3. Remove punctuation from words (.,!?;: etc.)
4. Return a dictionary with word counts
5. Handle empty string (return empty dict)
6. Ignore empty "words" after punctuation removal

Examples:
- word_frequency("hello world hello") → {"hello": 2, "world": 1}
- word_frequency("Hello, hello!") → {"hello": 2}
- word_frequency("The cat and the dog") → {"the": 2, "cat": 1, "and": 1, "dog": 1}
- word_frequency("") → {}

Save to tasks/word_freq.py`,
    "Word frequency counter with normalization",
    `python -c "from tasks.word_freq import word_frequency; r=word_frequency('hello world hello'); assert r.get('hello')==2 and r.get('world')==1; r2=word_frequency('Hello, hello!'); assert r2.get('hello')==2; assert word_frequency('')=={}; print('PASS')"`,
    "word_freq"
  ),
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetSystem() {
  console.log('🔄 Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' });
    console.log('   ✓ Agents reset');
  } catch (e) {
    console.log('   ⚠ Could not reset agents');
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned + __init__.py created');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace');
  }
  await sleep(2000);
}

async function createTask(task) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[MIXED-8] ${task.title}`,
      description: task.description,
      expectedOutput: task.expectedOutput,
      taskType: 'code',
      priority: task.priority,
      maxIterations: task.tier === 'haiku' ? 10 : 5
    })
  });
  return response.json();
}

async function executeTask(taskId, agentId, description, expectedOutput, useClaude) {
  return await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: expectedOutput,
      use_claude: useClaude,
      model: useClaude ? 'claude-3-haiku-20240307' : null
    })
  });
}

async function waitForAgent(agentId, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`);
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(validation) {
  try {
    const { execSync } = require('child_process');
    // Extract Python code from 'python -c "..."' format
    const match = validation.match(/python -c "(.+)"/);
    if (!match) {
      console.log(`   Validation error: Invalid validation format`);
      return false;
    }
    const pythonCode = match[1];
    // Base64 encode to avoid all shell escaping issues
    const b64Code = Buffer.from(pythonCode).toString('base64');
    const cmd = `docker exec -e PYTHONPATH=/app/workspace abcc-agents python3 -c "import sys; sys.path.insert(0,'/app/workspace'); import base64; exec(base64.b64decode('${b64Code}').decode())"`;
    const result = execSync(cmd, {
      encoding: 'utf8',
      timeout: 15000
    });
    return result.includes('PASS');
  } catch (e) {
    const errMsg = e.stderr || e.message || '';
    if (errMsg.includes('ModuleNotFoundError') || errMsg.includes('No module')) {
      console.log(`   Validation error: Module not found (file not created)`);
    } else {
      console.log(`   Validation error: ${errMsg.substring(0, 70)}`);
    }
    return false;
  }
}

async function main() {
  const ollamaTasks = tasks.filter(t => t.tier === 'ollama');
  const haikuTasks = tasks.filter(t => t.tier === 'haiku');

  console.log('═'.repeat(65));
  console.log('🧪 MIXED 8-TASK TEST SUITE (Ollama + Haiku)');
  console.log('═'.repeat(65));
  console.log(`   📦 Ollama tasks: ${ollamaTasks.length} (simple, priority 3)`);
  console.log(`   🤖 Haiku tasks:  ${haikuTasks.length} (complex, priority 5)`);
  console.log('═'.repeat(65));

  await resetSystem();

  const results = { ollama: { passed: 0, failed: 0 }, haiku: { passed: 0, failed: 0 } };
  const startTime = Date.now();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const tierIcon = task.tier === 'ollama' ? '📦' : '🤖';
    console.log(`\n[${i + 1}/${tasks.length}] ${tierIcon} ${task.title}`);
    console.log(`   Tier: ${task.tier.toUpperCase()} (priority ${task.priority})`);
    console.log('─'.repeat(50));

    const taskStart = Date.now();

    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      const agentId = task.tier === 'haiku' ? 'qa-01' : 'coder-01';
      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: created.id, agentId })
      });
      console.log(`   Assigned to: ${agentId}`);

      console.log('   Executing...');
      const useClaude = task.tier === 'haiku';
      const execResponse = await executeTask(
        created.id, agentId, task.description, task.expectedOutput, useClaude
      );

      if (!execResponse.ok) {
        throw new Error('Execution failed');
      }

      const execResult = await execResponse.json();

      // Mark task complete to release the agent
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: execResult.success, result: execResult })
      });

      const elapsed = Math.floor((Date.now() - taskStart) / 1000);
      console.log(`   Validating... (${elapsed}s)`);

      if (await runValidation(task.validation)) {
        results[task.tier].passed++;
        console.log(`   ✅ PASSED (${elapsed}s)`);
      } else {
        results[task.tier].failed++;
        console.log(`   ❌ FAILED (${elapsed}s)`);
      }

      await waitForAgent(agentId);

    } catch (e) {
      results[task.tier].failed++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 50)}`);
      await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' }).catch(() => {});
      await sleep(2000);
    }
  }

  const duration = Math.floor((Date.now() - startTime) / 1000);
  const totalPassed = results.ollama.passed + results.haiku.passed;
  const totalTasks = tasks.length;

  console.log('\n' + '═'.repeat(65));
  console.log('📊 RESULTS BY TIER');
  console.log('═'.repeat(65));
  console.log(`   📦 Ollama: ${results.ollama.passed}/${ollamaTasks.length} passed (${Math.round(results.ollama.passed/ollamaTasks.length*100)}%)`);
  console.log(`   🤖 Haiku:  ${results.haiku.passed}/${haikuTasks.length} passed (${Math.round(results.haiku.passed/haikuTasks.length*100)}%)`);
  console.log('─'.repeat(65));
  console.log(`   📈 Total:  ${totalPassed}/${totalTasks} passed (${Math.round(totalPassed/totalTasks*100)}%)`);
  console.log(`   ⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('═'.repeat(65));

  if (results.ollama.passed === ollamaTasks.length) {
    console.log('\n✅ Ollama tier: All tasks passed!');
  } else {
    console.log(`\n⚠️  Ollama tier: ${results.ollama.failed} task(s) failed`);
  }

  if (results.haiku.passed === haikuTasks.length) {
    console.log('✅ Haiku tier: All tasks passed!');
  } else {
    console.log(`⚠️  Haiku tier: ${results.haiku.failed} task(s) failed`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
