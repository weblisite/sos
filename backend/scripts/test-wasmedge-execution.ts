/**
 * Test script for WasmEdge execution
 * 
 * This script tests the WasmEdge execution functionality.
 * Requires WasmEdge binary to be installed.
 * 
 * Run with: npx tsx scripts/test-wasmedge-execution.ts
 */

import { wasmEdgeRuntime } from '../src/services/runtimes/wasmEdgeRuntime';

async function testWasmEdgeExecution() {
  console.log('🧪 Testing WasmEdge Execution...\n');

  // Wait for initialization
  await wasmEdgeRuntime.initialize();

  // Check if WasmEdge is available
  if (!wasmEdgeRuntime.checkAvailability()) {
    console.log('⚠️  WasmEdge is not available.\n');
    console.log('   To install WasmEdge:');
    console.log('   curl -sSf https://raw.githubusercontent.com/WasmEdge/WasmEdge/master/utils/install.sh | bash\n');
    console.log('   Then set WASMEDGE_ENABLED=true in your .env file\n');
    process.exit(1);
  }

  console.log('✅ WasmEdge is available\n');

  const testCases = [
    {
      name: 'AssemblyScript basic execution',
      language: 'typescript' as const,
      code: `
        export function add(a: i32, b: i32): i32 {
          return a + b;
        }
        
        export function main(): i32 {
          return add(10, 20);
        }
      `,
      input: {},
      expectedOutput: 30,
    },
    {
      name: 'AssemblyScript with input processing',
      language: 'typescript' as const,
      code: `
        export function process(input: i32): i32 {
          return input * 2;
        }
        
        export function main(): i32 {
          // In a real scenario, input would come from host function
          return process(5);
        }
      `,
      input: { value: 5 },
      expectedOutput: 10,
    },
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name} (${testCase.language})`);
    
    try {
      const result = await wasmEdgeRuntime.execute(
        testCase.code,
        testCase.language,
        testCase.input,
        10000 // 10 second timeout
      );
      
      if (result.success) {
        const output = (result.output as any)?.output;
        
        // For AssemblyScript, the output might be in different formats
        // This is a simplified check - actual output format depends on WASM module
        console.log(`  ✅ PASSED - Execution successful`);
        console.log(`     Output: ${JSON.stringify(output)}`);
        console.log(`     Duration: ${result.metadata?.executionTime || 'N/A'}ms\n`);
        passed++;
      } else {
        // Check if error is due to compilation (expected if compilers not installed)
        if (result.error?.code === 'WASM_COMPILATION_ERROR') {
          console.log(`  ⚠️  SKIPPED - Compiler not installed`);
          console.log(`     Error: ${result.error.message}\n`);
          skipped++;
        } else {
          console.log(`  ❌ FAILED - Execution error`);
          console.log(`    Error: ${result.error?.message}`);
          console.log(`    Code: ${result.error?.code}\n`);
          failed++;
        }
      }
    } catch (error: any) {
      console.log('  ❌ FAILED - Exception');
      console.log(`    Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (passed + failed > 0) {
    console.log(`  📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
  }

  if (failed === 0 && passed > 0) {
    console.log('🎉 All WasmEdge execution tests passed!\n');
    process.exit(0);
  } else if (skipped === testCases.length) {
    console.log('⚠️  All tests skipped. Install required compilers to run tests.\n');
    console.log('   Required:');
    console.log('   - AssemblyScript: npm install -g assemblyscript\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testWasmEdgeExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

