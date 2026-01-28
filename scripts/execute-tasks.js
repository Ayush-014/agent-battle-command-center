#!/usr/bin/env node

/**
 * Execute all test tasks sequentially
 * Monitors progress and waits for completion
 */

const fs = require('fs');

const POLL_INTERVAL_MS = 5000; // Check status every 5 seconds
const MAX_WAIT_MINUTES = 15; // Abort if task takes longer than 15 minutes
const COMPLETION_DELAY_MS = 2000; // Wait 2 seconds after completion before checking agent

async function waitForAgentIdle(agentId, maxWaitSeconds = 60) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > maxWaitMs) {
      console.log(`⚠️  Agent ${agentId} did not become idle after ${maxWaitSeconds}s`);
      return false;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/agents/${agentId}`);
      const agent = await response.json();

      if (agent.status === 'idle') {
        return true;
      }

      // Wait before checking again (faster polling)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   Error checking agent status: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function waitForTaskCompletion(taskId, taskTitle) {
  const startTime = Date.now();
  const maxWaitMs = MAX_WAIT_MINUTES * 60 * 1000;

  console.log(`⏳ Waiting for completion...`);

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > maxWaitMs) {
      console.log(`⚠️  Timeout after ${MAX_WAIT_MINUTES} minutes`);
      return 'timeout';
    }

    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
      const task = await response.json();

      const elapsedSec = Math.floor(elapsed / 1000);
      console.log(`   [${elapsedSec}s] Status: ${task.status} (iteration ${task.currentIteration || 0})`);

      // Check if terminal state
      if (['completed', 'failed', 'aborted'].includes(task.status)) {
        return task.status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    } catch (error) {
      console.error(`   Error checking status: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

async function executeTasks() {
  console.log('🚀 Starting sequential task execution...\n');

  // Load task IDs
  const taskIds = JSON.parse(fs.readFileSync('scripts/test-task-ids.json', 'utf8'));

  const executionResults = [];

  for (let i = 0; i < taskIds.length; i++) {
    const task = taskIds[i];
    const taskNum = i + 1;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Task ${taskNum}/${taskIds.length}: ${task.title}`);
    console.log(`ID: ${task.id}`);
    console.log('='.repeat(70));

    const startTime = Date.now();

    try {
      // Get routing recommendation first
      console.log('📡 Getting routing recommendation...');
      const routeResponse = await fetch(`http://localhost:3001/api/queue/${task.id}/route`);
      const routing = await routeResponse.json();

      // Force use of coder-01 instead of coder-02
      if (routing.agentId === 'coder-02') {
        routing.agentId = 'coder-01';
        routing.agentName = 'Coder-01';
        console.log('🔄 Redirected from coder-02 to coder-01');
      }

      console.log(`🎯 Recommended: ${routing.agentName} (${routing.agentId})`);
      console.log(`   Reason: ${routing.reason}`);
      console.log(`   Confidence: ${(routing.confidence * 100).toFixed(0)}%`);

      // Assign to recommended agent
      console.log('📡 Assigning task...');
      const assignResponse = await fetch(`http://localhost:3001/api/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          agentId: routing.agentId
        })
      });

      if (!assignResponse.ok) {
        const errorText = await assignResponse.text();
        throw new Error(`Assignment failed: HTTP ${assignResponse.status} - ${errorText}`);
      }

      const assignedTask = await assignResponse.json();
      console.log(`✅ Assigned to: ${assignedTask.assignedAgent?.name || routing.agentId}`);

      // Trigger execution by calling agents service (this is synchronous and will block until complete)
      console.log('🚀 Executing task (this may take 30-60s)...');
      const executeStartTime = Date.now();

      const executeResponse = await fetch('http://localhost:8000/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          agent_id: routing.agentId,
          task_description: assignedTask.description,
          expected_output: assignedTask.expectedOutput || null,
          use_claude: assignedTask.assignedAgent?.config?.alwaysUseClaude || false
        })
      });

      const executeTime = Math.floor((Date.now() - executeStartTime) / 1000);

      if (!executeResponse.ok) {
        const errorText = await executeResponse.text();
        console.log(`❌ Execution failed after ${executeTime}s: ${errorText}`);

        // First, set iteration to max to trigger abort path (which resets agent)
        await fetch(`http://localhost:3001/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentIteration: 10  // Set to max to trigger abort path
          })
        });

        // Call completion endpoint (properly resets agent status)
        const completeResponse = await fetch(`http://localhost:3001/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            result: {},
            error: `Execution error: ${errorText}`
          })
        });

        if (!completeResponse.ok) {
          const compErrorText = await completeResponse.text();
          console.error(`⚠️  Failed to call completion endpoint: ${compErrorText}`);
        }

        executionResults.push({
          taskId: task.id,
          title: task.title,
          status: 'failed',
          error: errorText
        });
        continue;
      }

      const executeResult = await executeResponse.json();
      console.log(`✅ Execution completed in ${executeTime}s`);

      // Parse the result
      const resultOutput = executeResult.output ? JSON.parse(executeResult.output) : {};
      const taskSuccess = executeResult.success && resultOutput.success;
      const finalStatus = taskSuccess ? 'completed' : 'failed';

      console.log(`   Result: ${resultOutput.status || 'UNKNOWN'} (confidence: ${resultOutput.confidence || 0})`);
      console.log(`   Files created: ${resultOutput.files_created?.length || 0}`);

      // First, set iteration to max to trigger abort path (which resets agent)
      await fetch(`http://localhost:3001/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentIteration: 10  // Set to max to trigger abort path
        })
      });

      // Call completion endpoint (properly resets agent status)
      const completeResponse = await fetch(`http://localhost:3001/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: taskSuccess,
          result: resultOutput,
          error: taskSuccess ? null : (resultOutput.failure_reason || 'Task failed')
        })
      });

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        console.error(`⚠️  Failed to call completion endpoint: ${errorText}`);
      }

      console.log(`📝 Task marked as: ${finalStatus.toUpperCase()}`);

      // Give API time to process completion
      await new Promise(resolve => setTimeout(resolve, COMPLETION_DELAY_MS));

      // Wait for agent to become idle before proceeding to next task
      console.log(`⏳ Waiting for agent ${routing.agentId} to become idle...`);
      const agentIdle = await waitForAgentIdle(routing.agentId, 60);

      if (agentIdle) {
        console.log(`✅ Agent ${routing.agentId} is idle and ready for next task`);
      } else {
        console.log(`⚠️  Proceeding anyway - agent may still be busy`);
      }

      const duration = Date.now() - startTime;

      console.log(`\n${finalStatus === 'completed' ? '✅' : '❌'} Final status: ${finalStatus.toUpperCase()}`);
      console.log(`⏱️  Total duration: ${Math.floor(duration / 1000)}s`);

      executionResults.push({
        taskId: task.id,
        title: task.title,
        status: finalStatus,
        resultStatus: resultOutput.status,
        durationMs: duration,
        durationSec: Math.floor(duration / 1000),
        filesCreated: resultOutput.files_created?.length || 0,
        confidence: resultOutput.confidence || 0
      });

    } catch (error) {
      console.error(`❌ Error executing task: ${error.message}`);
      executionResults.push({
        taskId: task.id,
        title: task.title,
        status: 'error',
        error: error.message
      });
    }
  }

  // Save execution results
  fs.writeFileSync(
    'scripts/execution-results.json',
    JSON.stringify(executionResults, null, 2)
  );

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXECUTION SUMMARY');
  console.log('='.repeat(70));

  const completed = executionResults.filter(r => r.status === 'completed').length;
  const failed = executionResults.filter(r => r.status === 'failed').length;
  const aborted = executionResults.filter(r => r.status === 'aborted').length;
  const timeout = executionResults.filter(r => r.status === 'timeout').length;
  const errors = executionResults.filter(r => r.status === 'error').length;
  const skipped = executionResults.filter(r => r.status === 'skipped').length;

  console.log(`✅ Completed: ${completed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Aborted: ${aborted}`);
  console.log(`⏱️  Timeout: ${timeout}`);
  console.log(`💥 Errors: ${errors}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📝 Total: ${executionResults.length}`);

  const totalDuration = executionResults.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  console.log(`\n⏰ Total execution time: ${Math.floor(totalDuration / 1000 / 60)} minutes ${Math.floor((totalDuration / 1000) % 60)} seconds`);

  console.log('\n💾 Results saved to scripts/execution-results.json');

  return executionResults;
}

// Run if called directly
if (require.main === module) {
  executeTasks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { executeTasks };
