/**
 * Test script for Code Execution Logs API endpoints
 * 
 * This script tests the code execution logs endpoints with real data
 * Run with: tsx src/scripts/testCodeExecLogs.ts
 */

import { codeExecutionLogger } from '../services/codeExecutionLogger';
import { db } from '../config/database';
import { codeAgents } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

async function testCodeExecLogs() {
  console.log('🧪 Testing Code Execution Logs API Endpoints...\n');

  try {
    // 1. Get a code agent to test with
    console.log('1. Finding a code agent to test with...');
    const agents = await db.select().from(codeAgents).limit(1);
    
    if (agents.length === 0) {
      console.log('⚠️  No code agents found. Creating a test agent...');
      // Create a test agent
      const [testAgent] = await db
        .insert(codeAgents)
        .values({
          name: 'Test Agent for Logs',
          description: 'Test agent for execution logs testing',
          language: 'javascript',
          code: 'console.log("Hello, World!");',
          runtime: 'node',
          isPublic: false,
          deprecated: false,
        })
        .returning();
      
      console.log(`✅ Created test agent: ${testAgent.id}`);
      
      // 2. Create test execution logs
      console.log('\n2. Creating test execution logs...');
      const logIds = [];
      
      for (let i = 0; i < 5; i++) {
        const logId = await codeExecutionLogger.logExecution({
          codeAgentId: testAgent.id,
          runtime: 'node',
          language: 'javascript',
          durationMs: 100 + i * 10,
          memoryMb: 50 + i * 5,
          exitCode: 0,
          success: i < 4, // Last one fails
          errorMessage: i === 4 ? 'Test error message' : undefined,
          tokensUsed: 100 + i * 20,
          validationPassed: i < 4,
        });
        logIds.push(logId);
        console.log(`   ✅ Created log ${i + 1}: ${logId}`);
      }

      // 3. Test getAgentLogs
      console.log('\n3. Testing getAgentLogs...');
      const agentLogs = await codeExecutionLogger.getAgentLogs(testAgent.id, 10);
      console.log(`   ✅ Retrieved ${agentLogs.length} logs for agent ${testAgent.id}`);
      if (agentLogs.length > 0) {
        console.log(`   📊 Sample log:`, {
          id: agentLogs[0].id,
          success: agentLogs[0].success,
          durationMs: agentLogs[0].durationMs,
          errorMessage: agentLogs[0].errorMessage,
        });
      }

      // 4. Test getAgentStats
      console.log('\n4. Testing getAgentStats...');
      const stats = await codeExecutionLogger.getAgentStats(testAgent.id);
      console.log(`   ✅ Retrieved stats for agent ${testAgent.id}:`, stats);

      // 5. Test getWorkflowExecutionLogs (if we have a workflow execution)
      console.log('\n5. Testing getWorkflowExecutionLogs...');
      // Create a test workflow execution log
      const workflowLogId = await codeExecutionLogger.logExecution({
        workflowExecutionId: 'test-execution-123',
        nodeId: 'test-node-1',
        runtime: 'node',
        language: 'javascript',
        durationMs: 200,
        success: true,
      });
      console.log(`   ✅ Created workflow execution log: ${workflowLogId}`);
      
      const workflowLogs = await codeExecutionLogger.getWorkflowExecutionLogs('test-execution-123');
      console.log(`   ✅ Retrieved ${workflowLogs.length} logs for workflow execution`);
      if (workflowLogs.length > 0) {
        console.log(`   📊 Sample log:`, {
          id: workflowLogs[0].id,
          workflowExecutionId: workflowLogs[0].workflowExecutionId,
          nodeId: workflowLogs[0].nodeId,
        });
      }

      console.log('\n✅ All tests passed!');
      console.log('\n📋 Summary:');
      console.log(`   - Test agent ID: ${testAgent.id}`);
      console.log(`   - Created ${logIds.length} execution logs`);
      console.log(`   - Retrieved ${agentLogs.length} agent logs`);
      console.log(`   - Retrieved ${workflowLogs.length} workflow execution logs`);
      console.log(`   - Stats:`, stats);

    } else {
      const agent = agents[0];
      console.log(`✅ Found agent: ${agent.id} (${agent.name})`);

      // Test with existing agent
      const agentLogs = await codeExecutionLogger.getAgentLogs(agent.id, 10);
      console.log(`\n✅ Retrieved ${agentLogs.length} logs for agent ${agent.id}`);
      
      const stats = await codeExecutionLogger.getAgentStats(agent.id);
      console.log(`✅ Retrieved stats:`, stats);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testCodeExecLogs()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

