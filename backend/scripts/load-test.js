/**
 * Load Testing Script for Observability Overhead
 * 
 * This script tests the observability overhead to ensure it meets
 * the <150ms p95 target.
 * 
 * Usage:
 *   node backend/scripts/load-test.js [options]
 * 
 * Options:
 *   --iterations <n>    Number of iterations (default: 1000)
 *   --concurrency <n>   Concurrent requests (default: 10)
 *   --endpoint <url>    API endpoint to test (default: /api/v1/workflows/execute)
 *   --enable-observability  Enable observability features (default: true)
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const config = {
  iterations: parseInt(process.env.ITERATIONS || '1000', 10),
  concurrency: parseInt(process.env.CONCURRENCY || '10', 10),
  endpoint: process.env.ENDPOINT || '/api/v1/workflows/execute',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  enableObservability: process.env.ENABLE_OBSERVABILITY !== 'false',
  authToken: process.env.AUTH_TOKEN || '',
};

// Statistics
const stats = {
  total: 0,
  success: 0,
  errors: 0,
  latencies: [],
  p50: 0,
  p95: 0,
  p99: 0,
  min: Infinity,
  max: 0,
  mean: 0,
};

/**
 * Make a test request
 */
function makeRequest(iteration) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const url = new URL(config.endpoint, config.baseUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {}),
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        stats.total++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.success++;
        } else {
          stats.errors++;
        }
        stats.latencies.push(latency);
        stats.min = Math.min(stats.min, latency);
        stats.max = Math.max(stats.max, latency);
        resolve({ latency, statusCode: res.statusCode, success: res.statusCode < 300 });
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const latency = endTime - startTime;
      stats.total++;
      stats.errors++;
      stats.latencies.push(latency);
      reject({ latency, error });
    });

    // Send test payload
    const payload = JSON.stringify({
      workflowId: 'test-workflow',
      input: {
        message: `Test iteration ${iteration}`,
      },
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Calculate percentiles
 */
function calculatePercentiles() {
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const len = sorted.length;
  
  stats.p50 = sorted[Math.floor(len * 0.50)] || 0;
  stats.p95 = sorted[Math.floor(len * 0.95)] || 0;
  stats.p99 = sorted[Math.floor(len * 0.99)] || 0;
  stats.mean = sorted.reduce((sum, val) => sum + val, 0) / len || 0;
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('🚀 Starting Load Test');
  console.log('='.repeat(60));
  console.log(`Configuration:`);
  console.log(`  Iterations: ${config.iterations}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Endpoint: ${config.endpoint}`);
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  Observability: ${config.enableObservability ? 'Enabled' : 'Disabled'}`);
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();
  const promises = [];
  
  // Create batches of concurrent requests
  for (let i = 0; i < config.iterations; i += config.concurrency) {
    const batch = [];
    for (let j = 0; j < config.concurrency && (i + j) < config.iterations; j++) {
      batch.push(
        makeRequest(i + j).catch((error) => {
          console.error(`Request ${i + j} failed:`, error);
        })
      );
    }
    promises.push(Promise.all(batch));
    
    // Small delay between batches to avoid overwhelming
    if (i + config.concurrency < config.iterations) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Wait for all requests to complete
  await Promise.all(promises);
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Calculate statistics
  calculatePercentiles();

  // Print results
  console.log('');
  console.log('📊 Test Results');
  console.log('='.repeat(60));
  console.log(`Total Requests: ${stats.total}`);
  console.log(`Successful: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(2)}%)`);
  console.log(`Errors: ${stats.errors} (${((stats.errors / stats.total) * 100).toFixed(2)}%)`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Requests/sec: ${((stats.total / totalTime) * 1000).toFixed(2)}`);
  console.log('');
  console.log('⏱️  Latency Statistics (ms)');
  console.log('='.repeat(60));
  console.log(`Min: ${stats.min}ms`);
  console.log(`Max: ${stats.max}ms`);
  console.log(`Mean: ${stats.mean.toFixed(2)}ms`);
  console.log(`P50: ${stats.p50}ms`);
  console.log(`P95: ${stats.p95}ms ⚠️  Target: <150ms`);
  console.log(`P99: ${stats.p99}ms`);
  console.log('='.repeat(60));
  console.log('');

  // Check if target is met
  if (stats.p95 < 150) {
    console.log('✅ SUCCESS: P95 latency is below 150ms target!');
  } else {
    console.log('❌ FAILURE: P95 latency exceeds 150ms target');
    console.log(`   Current: ${stats.p95}ms`);
    console.log(`   Target: <150ms`);
    console.log(`   Overhead: ${(stats.p95 - 150).toFixed(2)}ms`);
  }
  console.log('');

  // Export results as JSON
  const results = {
    config,
    stats: {
      ...stats,
      totalTime,
      requestsPerSecond: (stats.total / totalTime) * 1000,
      targetMet: stats.p95 < 150,
    },
    timestamp: new Date().toISOString(),
  };

  console.log('💾 Results exported to load-test-results.json');
  require('fs').writeFileSync(
    'load-test-results.json',
    JSON.stringify(results, null, 2)
  );

  process.exit(stats.p95 < 150 ? 0 : 1);
}

// Parse command line arguments
process.argv.forEach((arg, index) => {
  if (arg === '--iterations' && process.argv[index + 1]) {
    config.iterations = parseInt(process.argv[index + 1], 10);
  } else if (arg === '--concurrency' && process.argv[index + 1]) {
    config.concurrency = parseInt(process.argv[index + 1], 10);
  } else if (arg === '--endpoint' && process.argv[index + 1]) {
    config.endpoint = process.argv[index + 1];
  } else if (arg === '--base-url' && process.argv[index + 1]) {
    config.baseUrl = process.argv[index + 1];
  } else if (arg === '--auth-token' && process.argv[index + 1]) {
    config.authToken = process.argv[index + 1];
  } else if (arg === '--disable-observability') {
    config.enableObservability = false;
  }
});

// Run the test
runLoadTest().catch((error) => {
  console.error('❌ Load test failed:', error);
  process.exit(1);
});

