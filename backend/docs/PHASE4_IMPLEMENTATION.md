# Phase 4: Self-Healing, Observability, and Data Warehouse Integration

This document provides comprehensive documentation for all Phase 4 features implemented in the SynthralOS platform.

## Table of Contents

1. [StackStorm Integration](#stackstorm-integration)
2. [Self-Healing Service](#self-healing-service)
3. [Retry and Reroute Logic](#retry-and-reroute-logic)
4. [Cron Backoffs](#cron-backoffs)
5. [RudderStack Integration](#rudderstack-integration)
6. [Observability Enhancements](#observability-enhancements)
7. [Performance Considerations](#performance-considerations)

## StackStorm Integration

### Overview

StackStorm is an event-driven automation platform integrated into SynthralOS to enable advanced self-healing, retry, and reroute workflows.

### Configuration

**Environment Variables:**
- `STACKSTORM_API_URL`: StackStorm API URL (default: `http://localhost:8080/api/v1`)
- `STACKSTORM_API_KEY`: StackStorm API key for authentication
- `STACKSTORM_USERNAME`: StackStorm username (alternative to API key)
- `STACKSTORM_PASSWORD`: StackStorm password (alternative to API key)
- `ENABLE_STACKSTORM`: Enable StackStorm integration (default: `false`)
- `STACKSTORM_TIMEOUT`: Request timeout in ms (default: `30000`)
- `STACKSTORM_RETRY_ATTEMPTS`: Number of retry attempts (default: `3`)
- `STACKSTORM_RETRY_DELAY`: Retry delay in ms (default: `1000`)

### Services

#### StackStormService (`backend/src/services/stackstormService.ts`)

Core service for interacting with StackStorm API.

**Key Methods:**
- `authenticate()`: Authenticate with StackStorm
- `executeAction()`: Execute a StackStorm action or workflow
- `getExecutionStatus()`: Get status of an execution
- `triggerEvent()`: Trigger a StackStorm event
- `healthCheck()`: Check StackStorm availability

#### StackStormWorkflowService (`backend/src/services/stackstormWorkflowService.ts`)

Service for executing specific recovery workflows.

**Workflows:**
- `executeAgentRecovery()`: Execute agent recovery workflow
- `executeLLMRetry()`: Execute LLM retry workflow
- `executeRerouteRequest()`: Execute reroute request workflow

#### StackStorm-BullMQ Integration (`backend/src/services/stackstormBullMQIntegration.ts`)

Bidirectional integration between StackStorm and BullMQ for queue-based workflow execution.

**Features:**
- Queue StackStorm workflows from BullMQ
- Process StackStorm workflows in background workers
- Automatic retry and error handling

### StackStorm Packs

The `synthralos` pack contains three main workflows:

1. **Agent Recovery** (`agent_recovery.yaml`): Orchestrates agent failure recovery
2. **LLM Retry** (`llm_retry.yaml`): Implements robust LLM retry with exponential backoff
3. **Reroute Request** (`reroute_request.yaml`): Handles request rerouting to fallback regions/providers

### Setup

See `backend/docs/STACKSTORM_SETUP.md` for detailed setup instructions.

## Self-Healing Service

### Overview

The self-healing service detects agent failures and automatically generates and executes repair plans.

### Features

- **Failure Detection**: Detects various failure types (timeout, error, invalid output, tool failure, LLM error)
- **Repair Plan Generation**: Uses LLM to generate intelligent repair plans
- **Repair Execution**: Executes repair plans with priority-based step execution
- **StackStorm Integration**: Uses StackStorm workflows for advanced recovery
- **Observability**: Records all failures and repair attempts

### Service Location

`backend/src/services/selfHealingService.ts`

### Key Methods

- `detectFailure()`: Detect failures from agent execution results
- `generateRepairPlan()`: Generate repair plan for a failure
- `executeRepairPlan()`: Execute a repair plan
- `queueRepair()`: Queue repair for async execution
- `recordFailure()`: Record failure for monitoring

### Failure Types

- `timeout`: Execution exceeded time limit
- `error`: Execution threw an error
- `invalid_output`: Output is empty or contains error indicators
- `tool_failure`: Tool execution failed
- `llm_error`: LLM call failed

### Repair Actions

- `retry_execution`: Retry the entire execution
- `retry_tool`: Retry failed tool execution
- `retry_with_backoff`: Retry with exponential backoff
- `reduce_max_iterations`: Reduce max iterations to prevent timeout
- `simplify_query`: Simplify the query
- `regenerate_output`: Regenerate output with clearer instructions
- `switch_provider`: Switch to alternative LLM provider

### Feature Flags

- `enable_stackstorm_repair_execution`: Use StackStorm for repair plan execution
- `enable_stackstorm_repair_actions`: Use StackStorm for specific repair actions
- `enable_stackstorm_failure_monitoring`: Trigger StackStorm events for failures
- `enable_stackstorm_bullmq_integration`: Use StackStorm-BullMQ integration

## Retry and Reroute Logic

### RetryService (`backend/src/services/retryService.ts`)

Unified retry service with StackStorm integration.

**Features:**
- Exponential backoff
- Model fallback support
- StackStorm workflow integration
- Error classification

**Key Methods:**
- `executeWithRetry()`: Execute function with retry logic
- `retryWithReroute()`: Retry with reroute support

### Reroute Logic

Integrated into `ArchGWService` and `LLM Executor`:

- Automatic rerouting on failure
- Fallback region/provider support
- StackStorm workflow integration
- Simple fallback mechanism

### Feature Flags

- `enable_stackstorm_retry`: Use StackStorm for retries
- `enable_reroute`: Enable reroute logic
- `enable_stackstorm_reroute`: Use StackStorm for rerouting

## Cron Backoffs

### CronBackoffService (`backend/src/services/cronBackoffService.ts`)

Service for managing exponential backoffs for scheduled workflows.

**Features:**
- Tracks consecutive failures
- Calculates exponential backoff delays
- Disables jobs after max failures
- Redis-backed storage with in-memory fallback

**Configuration:**
- `maxConsecutiveFailures`: Maximum failures before disabling (default: `10`)
- `initialBackoffMs`: Initial backoff delay (default: `60000` = 1 minute)
- `maxBackoffMs`: Maximum backoff delay (default: `86400000` = 24 hours)
- `backoffMultiplier`: Exponential multiplier (default: `2`)

### Integration

Integrated into `SchedulerService` to prevent resource exhaustion from repeatedly failing scheduled workflows.

**Feature Flag:**
- `enable_cron_backoff`: Enable cron backoff logic

## RudderStack Integration

### Overview

RudderStack is used for event forwarding to data warehouses for analytics and reporting.

### Configuration

**Environment Variables:**
- `RUDDERSTACK_WRITE_KEY`: RudderStack write key (required)
- `RUDDERSTACK_DATA_PLANE_URL`: Data plane URL (default: `https://hosted.rudderlabs.com`)
- `RUDDERSTACK_MAX_RETRIES`: Max retries for failed events (default: `3`)
- `RUDDERSTACK_RETRY_DELAY`: Retry delay in ms (default: `1000`)
- `RUDDERSTACK_BATCH_SIZE`: Batch size for events (default: `20`)
- `RUDDERSTACK_FLUSH_INTERVAL`: Flush interval in ms (default: `10000`)

### Service Location

`backend/src/services/rudderstackService.ts`

### Features

- **Event Batching**: Batches events for efficient transmission
- **Retry Logic**: Exponential backoff retry for failed events
- **Event Queue**: In-memory queue for event buffering
- **Automatic Flushing**: Periodic flush timer for queued events

### Event Types

#### Observability Events

- `agent_execution`: Agent execution events
- `agent_repair`: Agent repair attempts
- `agent_failure`: Agent failure events
- Custom events via `logEvent()` and `recordEvent()`

#### Cost Logs

- `llm_cost_logged`: LLM cost tracking events

**Properties:**
- `cost_log_id`: Unique cost log identifier
- `provider`, `model`: LLM provider and model
- `input_tokens`, `output_tokens`, `total_tokens`: Token usage
- `cost_usd`, `cost_usd_cents`: Cost in USD and cents
- `input_cost`, `output_cost`: Separate input/output costs
- `input_cost_per_1k`, `output_cost_per_1k`: Per-1k token rates
- Context: `agent_id`, `workflow_execution_id`, `node_id`, `trace_id`

#### Similarity Logs

- `prompt_similarity_logged`: Prompt similarity check events

**Properties:**
- `similarity_log_id`: Unique similarity log identifier
- `prompt`: The prompt being checked (truncated to 1000 chars)
- `similarity_score`: Similarity score (0.0-1.0)
- `similarity_score_percent`: Similarity score as percentage (0-100)
- `flagged_reference`: Reference ID for flagged content
- `flagged_content`: The flagged content that matched (truncated)
- `action_taken`: Action taken (blocked/allowed/flagged/warned)
- `threshold`: Threshold used for comparison
- `method`: Similarity method (cosine/euclidean/dot_product/manhattan)
- Context: `workflow_execution_id`, `node_id`, `trace_id`

### Integration Points

- **ObservabilityService**: Forwards all observability events
- **CostLoggingService**: Forwards all cost logs
- **GuardrailsService**: Forwards all similarity logs

## Observability Enhancements

### Enhanced Event Recording

- All events include trace IDs for distributed tracing
- Workspace/organization context for grouping
- Rich metadata for analysis

### Event Types

- `agent_execution`: Agent execution metrics
- `agent_repair`: Repair attempts
- `agent_failure`: Failure events
- Custom events via `recordEvent()`

### Integration

- OpenTelemetry span linking
- Langfuse trace linking
- RudderStack forwarding

## Performance Considerations

### Overhead Targets

- **Target**: <150ms p95 overhead for observability
- **Current**: Async processing minimizes blocking
- **Optimizations**:
  - Async queue-based processing
  - Event batching
  - Non-blocking error handling

### Batching

- Events are batched before transmission
- Configurable batch size (default: 20 events)
- Automatic flush on batch size or time interval

### Retry Logic

- Exponential backoff prevents overwhelming services
- Max retries prevent infinite loops
- Failed events are logged but don't block execution

### Resource Usage

- In-memory queues with Redis fallback
- Automatic cleanup of processed events
- Graceful degradation when services unavailable

## Feature Flags

All Phase 4 features are controlled by feature flags:

### StackStorm
- `enable_stackstorm`: Enable StackStorm integration
- `enable_stackstorm_retry`: Use StackStorm for retries
- `enable_stackstorm_reroute`: Use StackStorm for rerouting
- `enable_stackstorm_repair_execution`: Use StackStorm for repair execution
- `enable_stackstorm_repair_actions`: Use StackStorm for repair actions
- `enable_stackstorm_failure_monitoring`: Trigger StackStorm events for failures
- `enable_stackstorm_bullmq_integration`: Use StackStorm-BullMQ integration

### Retry and Reroute
- `enable_reroute`: Enable reroute logic

### Cron Backoffs
- `enable_cron_backoff`: Enable cron backoff logic

### Observability
- `track_model_costs`: Enable cost tracking
- `enable_similarity_logging`: Enable similarity logging
- `enable_guardrails_tracing`: Enable guardrails tracing

## Monitoring and Debugging

### Logging

All services include comprehensive logging:
- `[StackStorm]`: StackStorm-related logs
- `[Self-Healing]`: Self-healing service logs
- `[Retry]`: Retry service logs
- `[CronBackoff]`: Cron backoff logs
- `[RudderStack]`: RudderStack forwarding logs
- `[Observability]`: Observability service logs

### Metrics

- Queue statistics via `rudderstackService.getQueueStats()`
- Failure history via `selfHealingService.getFailureHistory()`
- System metrics via `observabilityService.getSystemMetrics()`

### Health Checks

- StackStorm: `stackstormService.healthCheck()`
- RudderStack: Queue statistics and error logs

## Troubleshooting

### StackStorm Not Available

- Check `ENABLE_STACKSTORM` environment variable
- Verify StackStorm API URL and credentials
- Check StackStorm service health
- System falls back to standard execution

### RudderStack Events Not Sending

- Check `RUDDERSTACK_WRITE_KEY` environment variable
- Verify queue statistics: `rudderstackService.getQueueStats()`
- Check error logs for failed events
- Events are queued and retried automatically

### High Overhead

- Reduce batch sizes
- Increase flush intervals
- Disable non-critical event forwarding
- Check for blocking operations

## Future Enhancements

- [ ] Real-time event streaming
- [ ] Advanced analytics dashboards
- [ ] Machine learning for failure prediction
- [ ] Automated threshold tuning
- [ ] Multi-region StackStorm deployment
- [ ] Event replay capabilities

