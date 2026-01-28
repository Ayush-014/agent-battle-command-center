#!/usr/bin/env node

/**
 * Pre-flight verification script
 * Checks that all services are running and system is ready
 */

async function checkEndpoint(name, url, expectedStatus = 200) {
  try {
    const response = await fetch(url);
    const success = response.status === expectedStatus;

    console.log(`${success ? '✅' : '❌'} ${name}: ${response.status} ${response.statusText}`);
    return success;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function verifySystem() {
  console.log('🔍 Verifying system status...\n');

  let allOk = true;

  // Check API server
  console.log('1️⃣  Checking API Server (localhost:3001)...');
  allOk = await checkEndpoint('Tasks API', 'http://localhost:3001/api/tasks') && allOk;
  allOk = await checkEndpoint('Agents API', 'http://localhost:3001/api/agents') && allOk;
  allOk = await checkEndpoint('Queue API', 'http://localhost:3001/api/queue') && allOk;
  allOk = await checkEndpoint('Training Data API', 'http://localhost:3001/api/training-data') && allOk;

  // Check Python agents service
  console.log('\n2️⃣  Checking Agents Service (localhost:8000)...');
  allOk = await checkEndpoint('Agents Health', 'http://localhost:8000/health') && allOk;

  // Check agent status
  console.log('\n3️⃣  Checking Agent Status...');
  try {
    const response = await fetch('http://localhost:3001/api/agents');
    const agents = await response.json();

    agents.forEach(agent => {
      const statusIcon = agent.status === 'idle' ? '✅' : '⚠️';
      console.log(`${statusIcon} ${agent.name} (${agent.id}): ${agent.status}`);
    });

    const allIdle = agents.every(a => a.status === 'idle');
    if (!allIdle) {
      console.log('\n⚠️  Warning: Some agents are not idle. Consider running reset-all endpoint.');
      allOk = false;
    }

    // Check for CTO agent
    const ctoAgent = agents.find(a => a.id.startsWith('cto'));
    if (!ctoAgent) {
      console.log('\n❌ CTO agent not found! Run database seed: docker compose exec api npx prisma db seed');
      allOk = false;
    } else {
      console.log(`✅ CTO agent found: ${ctoAgent.name}`);
    }

  } catch (error) {
    console.log(`❌ Failed to check agents: ${error.message}`);
    allOk = false;
  }

  // Check for existing tasks
  console.log('\n4️⃣  Checking for existing tasks...');
  try {
    const response = await fetch('http://localhost:3001/api/tasks');
    const tasks = await response.json();

    if (tasks.length > 0) {
      console.log(`⚠️  Found ${tasks.length} existing task(s). Recommend cleaning up before starting.`);
      console.log('   Run: DELETE http://localhost:3001/api/tasks/<task-id> for each task');
    } else {
      console.log('✅ No existing tasks - clean state');
    }
  } catch (error) {
    console.log(`❌ Failed to check tasks: ${error.message}`);
    allOk = false;
  }

  // Check training data
  console.log('\n5️⃣  Checking training data...');
  try {
    const response = await fetch('http://localhost:3001/api/training-data/stats');
    const stats = await response.json();

    console.log(`📊 Current training data: ${stats.total} entries`);
    console.log(`   Claude: ${stats.claudeExecutions}, Local: ${stats.localExecutions}`);
    console.log(`   Good examples: ${stats.goodExamples}`);
  } catch (error) {
    console.log(`❌ Failed to check training data: ${error.message}`);
    allOk = false;
  }

  // Check Ollama (optional)
  console.log('\n6️⃣  Checking Ollama (optional)...');
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Ollama available with ${data.models?.length || 0} model(s)`);
    }
  } catch (error) {
    console.log(`⚠️  Ollama not accessible: ${error.message}`);
    console.log('   This is OK if using Claude for all agents');
  }

  // Check ANTHROPIC_API_KEY
  console.log('\n7️⃣  Checking Claude API key...');
  try {
    const response = await fetch('http://localhost:8000/health');
    const health = await response.json();

    // Health check doesn't expose API key, but we can infer
    console.log('⚠️  Cannot verify ANTHROPIC_API_KEY from API');
    console.log('   Ensure it\'s set in .env file if using CTO agent');
  } catch (error) {
    console.log(`⚠️  Could not verify: ${error.message}`);
  }

  // Final verdict
  console.log('\n' + '='.repeat(70));
  if (allOk) {
    console.log('✅ SYSTEM READY - All checks passed!');
    console.log('='.repeat(70));
    console.log('\nYou can now run: node scripts/run-diagnostic-suite.js');
  } else {
    console.log('❌ SYSTEM NOT READY - Fix issues above before proceeding');
    console.log('='.repeat(70));
    console.log('\nCommon fixes:');
    console.log('  - Start services: docker compose up');
    console.log('  - Reset agents: curl -X POST http://localhost:3001/api/agents/reset-all');
    console.log('  - Seed database: docker compose exec api npx prisma db seed');
  }

  return allOk;
}

// Run if called directly
if (require.main === module) {
  verifySystem()
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { verifySystem };
