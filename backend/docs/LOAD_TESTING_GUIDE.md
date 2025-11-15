# Load Testing and Performance Profiling Guide

This guide provides instructions for load testing and performance profiling to ensure the observability system meets the <150ms p95 overhead target.

## Overview

The goal is to measure and optimize the overhead introduced by observability features (tracing, logging, cost tracking, etc.) to ensure it stays below 150ms at the 95th percentile.

## Prerequisites

1. **Test Environment**: A staging or test environment with the application deployed
2. **Test Data**: Sample workflows and agents for testing
3. **Monitoring Tools**: Access to application logs and metrics
4. **Load Testing Tool**: The provided script or tools like k6, Apache Bench, or Artillery

## Load Testing Script

A Node.js load testing script is provided at `backend/scripts/load-test.js`.

### Basic Usage

```bash
# Basic test with default settings (1000 iterations, 10 concurrent)
node backend/scripts/load-test.js

# Custom configuration
node backend/scripts/load-test.js \
  --iterations 5000 \
  --concurrency 50 \
  --endpoint /api/v1/workflows/execute \
  --base-url http://localhost:3000 \
  --auth-token YOUR_TOKEN
```

### Environment Variables

```bash
export ITERATIONS=1000
export CONCURRENCY=10
export ENDPOINT=/api/v1/workflows/execute
export BASE_URL=http://localhost:3000
export AUTH_TOKEN=your_token_here
export ENABLE_OBSERVABILITY=true

node backend/scripts/load-test.js
```

### Test with Observability Disabled

To measure baseline performance without observability:

```bash
node backend/scripts/load-test.js --disable-observability
```

Compare results with observability enabled to measure overhead.

## Performance Profiling

### 1. Measure Baseline Performance

First, measure performance with observability disabled:

```bash
# Disable observability features via feature flags
export ENABLE_LANGFUSE_EXPORT=false
export ENABLE_ASYNC_TRACE_EXPORT=false
export TRACK_MODEL_COSTS=false
export ENABLE_SIMILARITY_LOGGING=false

# Run load test
node backend/scripts/load-test.js --disable-observability > baseline-results.txt
```

### 2. Measure with Observability Enabled

Enable observability features:

```bash
# Enable observability features
export ENABLE_LANGFUSE_EXPORT=true
export ENABLE_ASYNC_TRACE_EXPORT=true
export TRACK_MODEL_COSTS=true
export ENABLE_SIMILARITY_LOGGING=true

# Run load test
node backend/scripts/load-test.js > observability-results.txt
```

### 3. Calculate Overhead

Compare the results:

```bash
# Extract P95 values
BASELINE_P95=$(grep "P95:" baseline-results.txt | awk '{print $2}')
OBSERVABILITY_P95=$(grep "P95:" observability-results.txt | awk '{print $2}')

# Calculate overhead
OVERHEAD=$(echo "$OBSERVABILITY_P95 - $BASELINE_P95" | bc)
echo "Overhead: ${OVERHEAD}ms"
```

## Using k6 for Load Testing

k6 is a modern load testing tool. Here's a sample script:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100
    { duration: '1m', target: 100 },   // Stay at 100
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<150'], // P95 must be below 150ms
    'errors': ['rate<0.01'],            // Error rate must be <1%
  },
};

export default function () {
  const url = 'http://localhost:3000/api/v1/workflows/execute';
  const payload = JSON.stringify({
    workflowId: 'test-workflow',
    input: { message: 'Test' },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  };

  const res = http.post(url, payload, params);
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 150ms': (r) => r.timings.duration < 150,
  });

  errorRate.add(!success);
  sleep(1);
}
```

Run with:
```bash
k6 run load-test.js
```

## Performance Optimization Strategies

### 1. Async Processing

Ensure all observability operations are async and non-blocking:

- ✅ Langfuse exports are async
- ✅ RudderStack forwarding is queued
- ✅ Database writes are async
- ✅ Trace processing is batched

### 2. Batching

Batch operations to reduce overhead:

- ✅ Langfuse: Batch size of 20
- ✅ RudderStack: Batch size of 20
- ✅ Database: Batch inserts where possible

### 3. Caching

Use caching to reduce database queries:

- ✅ Feature flags cached
- ✅ Policy evaluation cached
- ✅ Rate limit state cached in Redis

### 4. Parallel Processing

Process operations in parallel:

- ✅ Batch processing uses Promise.allSettled
- ✅ Multiple events processed concurrently

### 5. Conditional Execution

Only execute when needed:

- ✅ Feature flags control execution
- ✅ Early returns for disabled features
- ✅ Conditional logging

## Monitoring During Tests

### Application Metrics

Monitor these metrics during load tests:

1. **CPU Usage**: Should stay reasonable
2. **Memory Usage**: Watch for memory leaks
3. **Database Connections**: Should not exhaust pool
4. **Queue Sizes**: RudderStack and Langfuse queues
5. **Error Rates**: Should be minimal

### Key Metrics to Track

```bash
# Queue statistics
curl http://localhost:3000/api/v1/observability/queue-stats

# System metrics
curl http://localhost:3000/api/v1/observability/metrics

# Error logs
curl http://localhost:3000/api/v1/observability/errors
```

## Optimization Checklist

If P95 exceeds 150ms, check:

- [ ] Are all observability operations async?
- [ ] Are batches large enough?
- [ ] Is caching enabled?
- [ ] Are feature flags properly used?
- [ ] Is database connection pooling optimized?
- [ ] Are Redis connections pooled?
- [ ] Are there any blocking operations?
- [ ] Is parallel processing enabled?
- [ ] Are unnecessary operations skipped?

## Common Issues and Solutions

### Issue: High P95 Latency

**Possible Causes:**
- Blocking database operations
- Synchronous file I/O
- Large batch sizes causing delays
- Network latency to external services

**Solutions:**
- Ensure all operations are async
- Reduce batch sizes if needed
- Use connection pooling
- Add timeouts for external calls

### Issue: Memory Leaks

**Possible Causes:**
- Event queues growing unbounded
- Cached data not expiring
- Event listeners not cleaned up

**Solutions:**
- Implement queue size limits
- Add TTL to caches
- Clean up event listeners
- Monitor memory usage

### Issue: High Error Rates

**Possible Causes:**
- Database connection exhaustion
- Rate limiting too aggressive
- External service failures

**Solutions:**
- Increase connection pool size
- Adjust rate limits
- Add retry logic
- Implement circuit breakers

## Test Scenarios

### Scenario 1: Light Load
- **Iterations**: 100
- **Concurrency**: 5
- **Expected**: P95 < 50ms

### Scenario 2: Medium Load
- **Iterations**: 1000
- **Concurrency**: 10
- **Expected**: P95 < 100ms

### Scenario 3: Heavy Load
- **Iterations**: 5000
- **Concurrency**: 50
- **Expected**: P95 < 150ms

### Scenario 4: Stress Test
- **Iterations**: 10000
- **Concurrency**: 100
- **Expected**: P95 < 200ms (acceptable under stress)

## Reporting

After running tests, create a report with:

1. **Test Configuration**: Iterations, concurrency, endpoint
2. **Results**: P50, P95, P99, mean, min, max
3. **Comparison**: Baseline vs. with observability
4. **Overhead**: Calculated overhead
5. **Target Met**: Whether <150ms target was met
6. **Recommendations**: Optimization suggestions

## Continuous Monitoring

Set up continuous monitoring:

1. **Alerting**: Alert if P95 exceeds 150ms
2. **Dashboards**: Track latency over time
3. **Trends**: Monitor for degradation
4. **Automated Tests**: Run load tests in CI/CD

## Next Steps

1. Run baseline tests
2. Run tests with observability enabled
3. Calculate overhead
4. Optimize if needed
5. Re-test to verify improvements
6. Document results
7. Set up continuous monitoring

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [OpenTelemetry Performance](https://opentelemetry.io/docs/instrumentation/js/performance/)

