# Unused Backend Endpoints

**Date:** 2024-11-10  
**Status:** Available for Future Features

This document lists the 10 backend API endpoints that are fully functional and use real database data, but are not currently used by the frontend. These endpoints are production-ready and available for future UI features.

---

## The 10 Unused Endpoints

### 1. `GET /api/v1/executions/workflow/:workflowId`
**Route:** `backend/src/routes/executions.ts:15`  
**Purpose:** Get all executions for a specific workflow  
**Database:** ✅ Uses `workflow_executions` table  
**Use Case:** Execution history view for a workflow  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
[
  {
    "id": "exec_123",
    "workflowId": "wf_456",
    "status": "completed",
    "startedAt": "2024-11-10T10:00:00Z",
    "finishedAt": "2024-11-10T10:05:00Z"
  }
]
```

---

### 2. `GET /api/v1/templates/:id`
**Route:** `backend/src/routes/templates.ts:269`  
**Purpose:** Get a specific workflow template by ID  
**Database:** ⚠️ Static templates (stored in code)  
**Use Case:** Template detail view or preview  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
{
  "id": "template_123",
  "name": "Email Automation",
  "description": "Automated email workflow",
  "definition": { ... }
}
```

---

### 3. `GET /api/v1/alerts/:id`
**Route:** `backend/src/routes/alerts.ts:65`  
**Purpose:** Get a specific alert by ID  
**Database:** ✅ Uses `alerts` table  
**Use Case:** Alert detail view or edit form  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
{
  "id": "alert_123",
  "name": "High Failure Rate",
  "type": "failure",
  "conditions": [...],
  "notificationChannels": [...]
}
```

---

### 4. `GET /api/v1/roles/:id`
**Route:** `backend/src/routes/roles.ts:44`  
**Purpose:** Get a specific role by ID with permissions  
**Database:** ✅ Uses `roles`, `role_permissions`, `permissions` tables  
**Use Case:** Role detail view or edit form  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
{
  "id": "role_123",
  "name": "Workflow Manager",
  "description": "Can manage workflows",
  "permissions": [
    {
      "id": "perm_1",
      "resourceType": "workflow",
      "action": "write"
    }
  ]
}
```

---

### 5. `POST /api/v1/roles/:id/assign`
**Route:** `backend/src/routes/roles.ts:207`  
**Purpose:** Assign a role to an organization member  
**Database:** ✅ Uses `organization_members` table  
**Use Case:** Role assignment UI (assign role to user)  
**Status:** ✅ Fully functional, ready to use

**Request Body:**
```json
{
  "organizationMemberId": "member_123"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Role assigned successfully"
}
```

---

### 6. `POST /api/v1/teams/:id/members`
**Route:** `backend/src/routes/teams.ts:157`  
**Purpose:** Add a member to a team  
**Database:** ✅ Uses `team_members` table  
**Use Case:** Bulk member addition or direct member addition (alternative to invitations)  
**Status:** ✅ Fully functional, ready to use

**Request Body:**
```json
{
  "userId": "user_123",
  "roleId": "role_456" // optional
}
```

**Example Response:**
```json
{
  "id": "team_member_123",
  "teamId": "team_456",
  "userId": "user_123",
  "roleId": "role_456",
  "joinedAt": "2024-11-10T10:00:00Z"
}
```

---

### 7. `GET /health`
**Route:** `backend/src/index.ts:45`  
**Purpose:** Health check endpoint  
**Database:** ❌ No database (simple status check)  
**Use Case:** Monitoring, load balancer health checks  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-10T10:00:00.000Z"
}
```

---

### 8. `GET /api/v1`
**Route:** `backend/src/index.ts:62`  
**Purpose:** API information endpoint  
**Database:** ❌ No database (static info)  
**Use Case:** API discovery, version info  
**Status:** ✅ Fully functional, ready to use

**Example Response:**
```json
{
  "message": "SOS Automation Platform API v1"
}
```

---

### 9. `ALL /webhooks/:path` (Dynamic Webhook Routes)
**Route:** `backend/src/routes/webhooks.ts`  
**Purpose:** Dynamic webhook trigger endpoints  
**Database:** ✅ Uses `webhook_registry`, `workflows` tables  
**Use Case:** External webhook triggers (not called by frontend, but by external systems)  
**Status:** ✅ Fully functional, ready to use

**Note:** This is intentionally not called by the frontend - it's for external webhook triggers.

---

### 10. `DELETE /api/v1/workflows/:id` (Now Used ✅)
**Route:** `backend/src/routes/workflows.ts:263`  
**Purpose:** Delete a workflow  
**Database:** ✅ Uses `workflows` table (cascade deletes versions, executions)  
**Use Case:** Delete workflow from UI  
**Status:** ✅ **NOW USED** - Added to frontend in latest update

**Note:** This endpoint was previously unused but has been integrated into the frontend.

---

## Summary

### Actually Unused (9 endpoints):
1. ✅ `GET /api/v1/executions/workflow/:workflowId` - Execution history
2. ✅ `GET /api/v1/templates/:id` - Template detail
3. ✅ `GET /api/v1/alerts/:id` - Alert detail
4. ✅ `GET /api/v1/roles/:id` - Role detail
5. ✅ `POST /api/v1/roles/:id/assign` - Role assignment
6. ✅ `POST /api/v1/teams/:id/members` - Add team member
7. ✅ `GET /health` - Health check (monitoring)
8. ✅ `GET /api/v1` - API info (discovery)
9. ✅ `ALL /webhooks/:path` - Webhook triggers (external use)

### Recently Integrated (1 endpoint):
10. ✅ `DELETE /api/v1/workflows/:id` - **NOW USED** ✅

---

## Recommendations

### High Priority (User-Facing Features)
1. **Execution History View** - Use `GET /api/v1/executions/workflow/:workflowId`
   - Add execution history tab to workflow detail page
   - Show all executions for a workflow with status, timing, etc.

2. **Alert Detail View** - Use `GET /api/v1/alerts/:id`
   - Add alert detail modal/page
   - Show full alert configuration and history

3. **Role Assignment UI** - Use `POST /api/v1/roles/:id/assign`
   - Add UI to assign roles to organization members
   - Could be part of Teams or Roles management page

### Medium Priority (Enhancement Features)
4. **Template Detail View** - Use `GET /api/v1/templates/:id`
   - Add template preview/detail modal
   - Show template structure before creating workflow

5. **Role Detail View** - Use `GET /api/v1/roles/:id`
   - Add role detail modal/page
   - Show role permissions in detail

6. **Direct Team Member Addition** - Use `POST /api/v1/teams/:id/members`
   - Add option to directly add existing organization members to teams
   - Alternative to invitation flow

### Low Priority (Infrastructure)
7. **Health Check** - Use `GET /health`
   - Already functional for monitoring
   - Could add health status to admin dashboard

8. **API Info** - Use `GET /api/v1`
   - Already functional for API discovery
   - Could add API documentation page

9. **Webhook Routes** - Use `ALL /webhooks/:path`
   - Already functional for external triggers
   - No frontend integration needed (external use only)

---

## Implementation Notes

All unused endpoints:
- ✅ Are fully functional
- ✅ Use real database data (except health/API info)
- ✅ Have proper authentication/authorization
- ✅ Have error handling
- ✅ Are production-ready

**No additional backend work needed** - these endpoints are ready to be integrated into the frontend whenever needed.

---

**Last Updated:** 2024-11-10

