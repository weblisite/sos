# How to Use AI Agents in Workflows

## ✅ Yes, You Can Access Agents in Workflows!

AI agents are now fully integrated into the workflow builder. Here's how to use them:

---

## Step-by-Step Guide

### 1. Open Workflow Builder

1. Navigate to **Workflows** in the sidebar
2. Click **"Create Workflow"** or edit an existing workflow
3. The workflow builder will open

### 2. Add Agent Node

1. In the **Node Palette** on the left, click on the **"AI"** category (🤖 icon)
2. Find **"AI Agent"** in the list
3. Click on it to add it to the canvas
4. The agent node will appear on the workflow canvas

### 3. Configure Agent Node

1. **Click on the agent node** you just added
2. The **Configuration Panel** will open on the right
3. Configure the following settings:

#### Basic Configuration

- **Agent Type:**
  - `auto` - Intelligent routing (recommended, automatically selects best framework)
  - `react` - ReAct agent (reasoning + acting, tool use)
  - `agentgpt` - One-shot agent (fast, simple queries)
  - `autogpt` - Recursive planning (complex tasks)
  - `metagpt` - Multi-role agent (specialized tasks)
  - `autogen` - Collaborative agent (team coordination)

- **Provider:**
  - `openai` - OpenAI models (GPT-4, GPT-3.5-turbo)
  - `anthropic` - Anthropic models (Claude-3-opus, Claude-3-sonnet)

- **Model:**
  - Examples: `gpt-4`, `gpt-3.5-turbo`, `claude-3-opus`, `claude-3-sonnet`
  - Default: `gpt-4`

- **Temperature:** (0-2)
  - Controls randomness/creativity
  - Default: `0.7`
  - Lower = more deterministic, Higher = more creative

- **Max Iterations:**
  - Maximum number of agent reasoning steps
  - Default: `15`
  - Increase for complex tasks

#### Advanced Configuration

- **Tools:**
  - Select tools the agent can use:
    - `calculator` - Math operations
    - `wikipedia` - Information lookup
    - `serpapi` - Web search (SerpAPI)
    - `duckduckgo` - Web search (DuckDuckGo)
    - `brave` - Web search (Brave Search)

- **Memory Type:**
  - `buffer` - Stores recent messages (default, fast)
  - `summary` - Condenses old messages (efficient, slower)
  - `none` - No memory (stateless, fastest)

- **Use Routing:**
  - Enable intelligent framework routing (when Agent Type is `auto`)
  - Default: `true`

### 4. Connect Agent Node

1. **Connect Input:**
   - Drag an edge **FROM** another node **TO** the agent node
   - The agent will receive data from the previous node
   - The agent expects a `query` field in the input (or `input`/`message`)

2. **Connect Output:**
   - Drag an edge **FROM** the agent node **TO** another node
   - The agent output will flow to the next node
   - Output includes:
     - `output` - Agent response (string)
     - `intermediateSteps` - Reasoning steps (array)
     - `tokensUsed` - Tokens consumed (number)
     - `cost` - Execution cost (number)

### 5. Example Workflow

```
[Manual Trigger] 
    ↓
[AI Agent] ← Configure: Agent Type = "auto", Query = "Analyze this data"
    ↓
[HTTP Request] ← Send agent output to external API
    ↓
[Slack Notification] ← Notify team of results
```

---

## Common Use Cases

### 1. Data Analysis Workflow

```
[Webhook Trigger] (receives data)
    ↓
[AI Agent] 
  - Agent Type: "autogpt" (for complex analysis)
  - Query: "Analyze this data and identify trends"
  - Tools: ["calculator", "wikipedia"]
    ↓
[Database] (store analysis results)
```

### 2. Content Generation Workflow

```
[Schedule Trigger] (daily at 9 AM)
    ↓
[AI Agent]
  - Agent Type: "react" (for tool use)
  - Query: "Research latest AI news and create a summary"
  - Tools: ["serpapi", "wikipedia"]
    ↓
[Email Action] (send summary)
```

### 3. Multi-Agent Workflow

```
[Manual Trigger]
    ↓
[AI Agent] (Research Agent)
  - Agent Type: "react"
  - Query: "Research topic: {{input.topic}}"
    ↓
[AI Agent] (Writing Agent)
  - Agent Type: "agentgpt"
  - Query: "Write article based on: {{previous.output}}"
    ↓
[AI Agent] (Review Agent)
  - Agent Type: "react"
  - Query: "Review and improve: {{previous.output}}"
    ↓
[Save to File]
```

---

## Input Format

The agent node expects input in one of these formats:

### Format 1: Query String
```json
{
  "query": "What are the latest AI trends?"
}
```

### Format 2: Input Field
```json
{
  "input": "What are the latest AI trends?"
}
```

### Format 3: Message Field
```json
{
  "message": "What are the latest AI trends?"
}
```

### Format 4: Full Context
```json
{
  "query": "Analyze this data",
  "input": { "data": [...] },
  "context": { "userId": "123", "organizationId": "456" }
}
```

---

## Output Format

The agent node returns:

```json
{
  "output": "Agent response text...",
  "intermediateSteps": [
    {
      "action": { "tool": "calculator", "toolInput": "2+2" },
      "observation": "4"
    }
  ],
  "tokensUsed": 1500,
  "cost": 0.045
}
```

---

## Tips & Best Practices

### 1. Choose the Right Agent Type

- **Simple queries** → `agentgpt` (fast, one-shot)
- **Tool-heavy tasks** → `react` (reasoning + tool use)
- **Complex planning** → `autogpt` (recursive planning)
- **Multi-step workflows** → `metagpt` (multi-role)
- **Team coordination** → `autogen` (collaboration)
- **Not sure?** → `auto` (intelligent routing)

### 2. Optimize for Cost

- Use `gpt-3.5-turbo` for simple tasks (cheaper)
- Use `gpt-4` for complex reasoning (more expensive)
- Set appropriate `maxIterations` to limit costs
- Monitor `tokensUsed` and `cost` in output

### 3. Error Handling

- Connect agent output to error handling nodes
- Use `logic.error_catch` node to handle failures
- Set reasonable `maxIterations` to prevent timeouts

### 4. Memory Management

- Use `buffer` memory for short conversations
- Use `summary` memory for long-running workflows
- Use `none` for stateless, one-off queries

### 5. Tool Selection

- Only enable tools the agent actually needs
- Each tool adds latency and cost
- Start with essential tools, add more as needed

---

## Troubleshooting

### Agent Not Appearing in Node Palette?

1. Refresh the page
2. Check that you're in the **AI** category
3. Search for "AI Agent" in the search box

### Agent Execution Failing?

1. Check that `query` field is provided in input
2. Verify API keys are configured (OpenAI/Anthropic)
3. Check `maxIterations` isn't too low
4. Review error logs in execution monitor

### Agent Taking Too Long?

1. Reduce `maxIterations`
2. Use simpler agent type (`agentgpt` instead of `autogpt`)
3. Use faster model (`gpt-3.5-turbo` instead of `gpt-4`)
4. Disable unnecessary tools

### Agent Output Not as Expected?

1. Adjust `temperature` (lower = more focused)
2. Provide more context in the query
3. Try different agent type
4. Enable more tools if needed

---

## Access Points Summary

### In Workflows:
- **Node Palette** → **AI Category** → **"AI Agent"**
- Configure in **Configuration Panel** (right sidebar)
- Connect with other nodes via edges

### Standalone:
- **Agent Copilot** (`/agents/copilot`) - Chat interface
- **Agent Catalogue** (`/agents/catalogue`) - Browse frameworks
- **Observability** (`/observability`) - Monitor performance

---

## Next Steps

1. **Try it out:** Create a simple workflow with an agent node
2. **Experiment:** Try different agent types and configurations
3. **Monitor:** Check observability dashboard for performance
4. **Optimize:** Adjust settings based on results

**Happy automating! 🚀**

