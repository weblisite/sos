# Connectors vs Integrations: Understanding the Difference

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

---

## Overview

In the SynthralOS platform, **Connectors** and **Integrations** are related but distinct concepts that work together to enable external service connectivity. Understanding the difference is crucial for developers and users.

---

## Quick Answer

- **Integrations** = **User-facing workflow nodes** (e.g., `integration.slack`, `integration.airtable`)
- **Connectors** = **Backend infrastructure** that manages connector lifecycle, credentials, and execution

**Think of it this way:**
- **Integration** = The workflow node you drag and drop in the UI
- **Connector** = The backend system that makes that node work

---

## Detailed Comparison

### Integrations

**Definition:** Integration nodes are the workflow-level abstraction that users interact with when building workflows.

**Characteristics:**
- **Node Type Format:** `integration.{connector_id}` (e.g., `integration.slack`, `integration.salesforce`)
- **User-Facing:** What users see and configure in the workflow builder
- **Workflow-Level:** Part of the workflow execution graph
- **Configuration:** Set in workflow node config
- **Execution:** Routed through the connector system

**Example in Workflow:**
```json
{
  "id": "node-1",
  "type": "integration.slack",
  "config": {
    "action": "send_message",
    "channel": "#general",
    "text": "Hello from workflow!"
  }
}
```

**Location in Code:**
- Node executors: `backend/src/services/nodeExecutors/connector.ts`
- Node routing: `backend/src/services/nodeExecutors/index.ts` (line 141-143)

### Connectors

**Definition:** Connectors are the backend infrastructure that manages connector manifests, credentials, authentication, and execution routing.

**Characteristics:**
- **System-Level:** Backend infrastructure component
- **Manifest-Based:** Defined by connector manifests
- **Credential Management:** Handles OAuth, API keys, connection strings
- **Registry System:** Manages all available connectors
- **Execution Routing:** Routes actions to appropriate executors

**Example Connector Manifest:**
```json
{
  "id": "slack",
  "name": "Slack",
  "version": "1.0.0",
  "description": "Send messages and interact with Slack",
  "category": "communication",
  "oauthProvider": "nango",
  "auth": {
    "type": "oauth2",
    "scopes": ["chat:write", "channels:read"]
  },
  "actions": [
    {
      "id": "send_message",
      "name": "Send Message",
      "description": "Send a message to a Slack channel",
      "inputSchema": { /* ... */ },
      "outputSchema": { /* ... */ }
    }
  ]
}
```

**Location in Code:**
- Registry: `backend/src/services/connectors/registry.ts`
- Types: `backend/src/services/connectors/types.ts`
- Routes: `backend/src/routes/connectors.ts`

---

## How They Work Together

### Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│  Workflow Node: integration.slack                       │
│  Config: { action: "send_message", channel: "#general" }│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Node Executor: executeConnector()                      │
│  Extracts: connectorId = "slack"                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Connector Registry: connectorRegistry.get("slack")     │
│  Returns: ConnectorManifest                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Credential Service: Get encrypted credentials          │
│  Decrypts: OAuth tokens, API keys                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Connector Executor: executeConnectorAction()           │
│  Routes to: executeSlack() or connector-specific logic  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  External API: Slack API                                │
│  Returns: Result                                        │
└─────────────────────────────────────────────────────────┘
```

### Code Example

**1. Workflow Node (Integration):**
```typescript
// In workflow definition
{
  type: "integration.slack",
  config: {
    action: "send_message",
    channel: "#general",
    text: "Hello!"
  }
}
```

**2. Node Executor Routes to Connector:**
```typescript
// backend/src/services/nodeExecutors/index.ts
else if (nodeType.startsWith('integration.')) {
  // Use connector router for all integration nodes
  result = await executeConnector(context);
}
```

**3. Connector Executor:**
```typescript
// backend/src/services/nodeExecutors/connector.ts
export async function executeConnector(context: NodeExecutionContext) {
  // Extract connector ID from node type
  const nodeType = context.config.type; // "integration.slack"
  const connectorId = nodeType.replace('integration.', ''); // "slack"
  
  // Get connector from registry
  const connector = connectorRegistry.get(connectorId);
  
  // Get credentials
  const credentials = await getConnectorCredentials(...);
  
  // Execute action
  const result = await executeConnectorAction(connectorId, actionId, input, credentials);
  
  return result;
}
```

**4. Connector Registry:**
```typescript
// backend/src/services/connectors/registry.ts
class ConnectorRegistry {
  get(id: string): ConnectorManifest | undefined {
    return this.connectors.get(id);
  }
  
  async execute(connectorId: string, options: ConnectorExecuteOptions) {
    // Routes to appropriate executor
  }
}
```

---

## Key Differences Summary

| Aspect | Integrations | Connectors |
|--------|-------------|------------|
| **Level** | Workflow/User-facing | System/Backend |
| **Format** | `integration.{id}` | Connector manifest |
| **Purpose** | Workflow node type | Infrastructure system |
| **Configuration** | Workflow node config | Connector manifest |
| **Credentials** | Not stored here | Managed by connector system |
| **Registration** | Automatic (via connector) | Via API or built-in |
| **Execution** | Routed through connector | Direct execution |
| **User Interaction** | Drag & drop in UI | API/manifest-based |

---

## When to Use Each Term

### Use "Integration" When:
- ✅ Referring to workflow nodes
- ✅ Talking about user-facing features
- ✅ Describing workflow configuration
- ✅ Documenting workflow examples
- ✅ UI/UX discussions

**Example:** "Add an integration node to your workflow to send Slack messages."

### Use "Connector" When:
- ✅ Referring to backend infrastructure
- ✅ Talking about connector registry
- ✅ Describing connector manifests
- ✅ API documentation
- ✅ Developer/technical discussions

**Example:** "Register a new connector via the Connector API to add support for a new service."

---

## Examples

### Example 1: Slack Integration in Workflow

**User Perspective (Integration):**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "integration.slack",
      "config": {
        "action": "send_message",
        "channel": "#general",
        "text": "Hello!"
      }
    }
  ]
}
```

**System Perspective (Connector):**
```typescript
// Connector manifest defines available actions
{
  id: "slack",
  actions: [
    {
      id: "send_message",
      inputSchema: { /* ... */ },
      outputSchema: { /* ... */ }
    }
  ]
}

// Connector registry manages the connector
connectorRegistry.get("slack");

// Connector executor handles execution
executeConnectorAction("slack", "send_message", input, credentials);
```

### Example 2: Custom Connector Registration

**Developer registers a connector:**
```bash
POST /api/v1/connectors/register
{
  "manifest": {
    "id": "my_service",
    "name": "My Service",
    "actions": [ /* ... */ ]
  }
}
```

**Connector becomes available as integration:**
```json
{
  "type": "integration.my_service",
  "config": {
    "action": "do_something"
  }
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Workflow Builder UI                                  │   │
│  │  • Drag & drop integration nodes                      │   │
│  │  • Configure integration settings                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Execution Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Node Executor: executeConnector()                    │   │
│  │  • Receives: integration.{connector_id}              │   │
│  │  • Extracts: connector_id                            │   │
│  │  • Routes to: Connector System                       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Connector System Layer                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Connector Registry                                   │   │
│  │  • Manages connector manifests                        │   │
│  │  • Routes execution                                   │   │
│  │  • Handles versioning                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Credential Service                                   │   │
│  │  • Stores encrypted credentials                       │   │
│  │  • Handles OAuth flows                                │   │
│  │  • Manages token refresh                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Connector Executors                                  │   │
│  │  • executeSlack()                                     │   │
│  │  • executeSalesforce()                                │   │
│  │  • executeAirtable()                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  • Slack API                                                 │
│  • Salesforce API                                            │
│  • Airtable API                                              │
│  • ...                                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Questions

### Q: Can I have an integration without a connector?

**A:** No. Every integration node requires a corresponding connector in the registry. The connector defines what actions are available and how to execute them.

### Q: Can I have a connector without an integration?

**A:** Technically yes, but it wouldn't be useful. Connectors are designed to be used via integration nodes in workflows. However, connectors can also be executed directly via the API.

### Q: How do I add a new integration?

**A:** You register a new connector via the API. Once registered, it automatically becomes available as an integration node type (`integration.{connector_id}`).

### Q: What's the difference between `integration.slack` and `communication.slack`?

**A:** 
- `integration.slack` - Uses the connector system (OAuth, credential management, marketplace)
- `communication.slack` - Direct executor (legacy, simpler, but less features)

The platform is migrating to the connector-based approach for consistency.

### Q: Can I use connectors outside of workflows?

**A:** Yes! You can execute connectors directly via the API:
```bash
POST /api/v1/connectors/{connector_id}/actions/{action_id}/execute
```

---

## Migration Path

The platform supports both approaches for backward compatibility:

**Legacy (Direct Executors):**
```typescript
// Direct executor functions
executeSlack(context)
executeAirtable(context)
```

**Modern (Connector System):**
```typescript
// Connector-based routing
executeConnector(context) // Routes through connector system
```

**Current Status:**
- New connectors should use the connector system
- Legacy executors are maintained for backward compatibility
- All new features use the connector system

---

## Best Practices

### For Workflow Designers:
- ✅ Use `integration.{connector_id}` node types
- ✅ Configure actions via node config
- ✅ Connect credentials via marketplace
- ✅ Use connector marketplace to discover available integrations

### For Developers:
- ✅ Register connectors via API
- ✅ Define comprehensive manifests
- ✅ Implement connector executors
- ✅ Use connector registry for routing
- ✅ Follow connector manifest specification

### For System Administrators:
- ✅ Monitor connector registry
- ✅ Manage connector credentials
- ✅ Review connector usage
- ✅ Update connector versions

---

## Summary

**Integrations** and **Connectors** are two sides of the same coin:

- **Integrations** = The user-facing workflow nodes (`integration.slack`)
- **Connectors** = The backend infrastructure that powers them (connector registry, manifests, credentials)

They work together seamlessly:
1. User adds `integration.slack` node to workflow
2. System routes to `slack` connector
3. Connector system handles credentials and execution
4. Result flows back to workflow

Understanding this relationship helps you:
- Build better workflows
- Create custom connectors
- Troubleshoot integration issues
- Design new integrations

---

## Related Documentation

- [Connector Interfaces Documentation](./CONNECTOR_INTERFACES.md)
- [Connector Developer Guide](./CONNECTOR_DEVELOPER_GUIDE.md)
- [Workflow Builder Guide](../frontend/src/pages/WorkflowBuilder.tsx)

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

