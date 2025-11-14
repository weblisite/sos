# SynthralOS StackStorm Pack

This StackStorm pack provides recovery workflows for the SynthralOS automation platform.

## Workflows

### 1. Agent Recovery (`agent_recovery`)

Recovery workflow for failed agent executions. This workflow:
- Analyzes the failure type and details
- Generates a repair plan
- Executes recovery steps with retry logic
- Implements exponential backoff

**Parameters:**
- `agent_id` (required): ID of the failed agent
- `failure_type` (required): Type of failure (timeout, error, invalid_output, tool_failure, llm_error, unknown)
- `original_query` (required): Original query that failed
- `failure_details` (optional): Detailed failure information
- `context` (optional): Additional context for recovery
- `max_retries` (optional, default: 3): Maximum number of retry attempts
- `retry_delay` (optional, default: 5): Initial retry delay in seconds

### 2. LLM Retry (`llm_retry`)

Retry workflow for failed LLM calls with exponential backoff and model fallback.

**Parameters:**
- `original_request` (required): Original LLM request parameters
- `failure_reason` (required): Reason for failure
- `max_retries` (optional, default: 3): Maximum number of retry attempts
- `fallback_models` (optional): List of fallback models to try

### 3. Reroute Request (`reroute_request`)

Reroute workflow for failed requests with region/provider fallback.

**Parameters:**
- `original_request` (required): Original request parameters
- `failure_reason` (required): Reason for failure
- `fallback_regions` (optional): List of fallback regions
- `fallback_providers` (optional): List of fallback providers

## Installation

### Prerequisites

- StackStorm installed and running
- StackStorm CLI (`st2`) configured

### Deploy Pack

```bash
# From the backend directory
cd stackstorm-packs
st2 pack install synthralos
```

Or copy the pack to StackStorm packs directory:

```bash
# Copy pack to StackStorm packs directory
cp -r stackstorm-packs/synthralos /opt/stackstorm/packs/

# Reload pack
st2 pack reload synthralos

# Register actions
st2 action list --pack=synthralos
```

### Verify Installation

```bash
# List actions
st2 action list --pack=synthralos

# Get action details
st2 action get synthralos.agent_recovery
```

## Usage

### Execute Agent Recovery

```bash
st2 run synthralos.agent_recovery \
  agent_id="agent_123" \
  failure_type="timeout" \
  original_query="What is the weather?" \
  max_retries=3 \
  retry_delay=5
```

### Execute LLM Retry

```bash
st2 run synthralos.llm_retry \
  original_request='{"prompt": "Hello", "model": "gpt-4"}' \
  failure_reason="Rate limit exceeded" \
  max_retries=3 \
  fallback_models='["gpt-3.5-turbo", "claude-3-haiku"]'
```

### Execute Reroute

```bash
st2 run synthralos.reroute_request \
  original_request='{"endpoint": "/api/v1/llm", "model": "gpt-4"}' \
  failure_reason="Region unavailable" \
  fallback_regions='["eu-west-1", "us-west-2"]' \
  fallback_providers='["anthropic", "google"]'
```

## Integration

These workflows are integrated with the SynthralOS backend via the `stackstormWorkflowService`. See `backend/src/services/stackstormWorkflowService.ts` for usage examples.

## Development

### Workflow Structure

- Action definitions: `actions/*.yaml`
- Workflow definitions: `actions/workflows/*.yaml`
- Pack metadata: `pack.yaml`

### Testing Workflows

```bash
# Test workflow execution
st2 run synthralos.agent_recovery \
  agent_id="test_agent" \
  failure_type="error" \
  original_query="Test query"

# Check execution status
st2 execution get <execution_id>

# View execution logs
st2 execution tail <execution_id>
```

## Notes

These workflows require additional StackStorm actions to be implemented:
- `synthralos.analyze_agent_failure`
- `synthralos.generate_repair_plan`
- `synthralos.execute_recovery`
- `synthralos.log_recovery_failure`
- `synthralos.determine_retry_strategy`
- `synthralos.call_llm`
- `synthralos.log_retry_failure`
- `synthralos.analyze_routing_failure`
- `synthralos.execute_request`
- `synthralos.log_reroute_failure`

These actions can be implemented as:
1. Python actions that call the SynthralOS API
2. HTTP actions that make requests to SynthralOS endpoints
3. Orchestra sub-workflows

