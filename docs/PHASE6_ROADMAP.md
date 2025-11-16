# Phase 6: User Management & Access Control

**Status:** Ready to Start  
**Priority:** High  
**Estimated Complexity:** Medium

---

## Overview

Phase 6 focuses on enhancing user management, access control, and team collaboration features. This phase will build upon the existing multi-tenant architecture to provide fine-grained permissions, role-based access control (RBAC), and team management capabilities.

---

## Completed Phases

- ✅ **Phase 1:** Logic Nodes (IF/ELSE, Switch, Loops, Merge, Wait)
- ✅ **Phase 2:** Data Nodes (Database, File, CSV, JSON)
- ✅ **Phase 3:** Communication Nodes (Email, Slack, Discord, SMS, Google Sheets, Airtable, Notion, Zapier)
- ✅ **Phase 4:** Advanced AI Features (Vector Store, Document Ingestion, Semantic Search, RAG, Image Generation, Image Analysis, Audio Transcription, Text-to-Speech)
- ✅ **Phase 5:** Monitoring & Analytics (Enhanced Logs, Analytics Dashboard, Alerting System)

---

## Phase 6: User Management & Access Control

### 6.1 Enhanced User Roles & Permissions

**Goal:** Implement granular role-based access control (RBAC) with custom permissions.

**Features:**
- [ ] Custom role creation
- [ ] Permission matrix (read, write, execute, delete, admin)
- [ ] Resource-level permissions (workflow, workspace, organization)
- [ ] Role assignment UI
- [ ] Permission inheritance
- [ ] Role templates (Admin, Developer, Viewer, Guest)

**Database Changes:**
- New table: `roles` (custom roles)
- New table: `permissions` (permission definitions)
- New table: `role_permissions` (role-permission mapping)
- Update: `organization_members` (add role_id reference)

**Backend:**
- Permission middleware
- Permission checking service
- Role management API routes
- Permission evaluation logic

**Frontend:**
- Role management UI
- Permission matrix UI
- Role assignment in member management
- Permission indicators in UI

---

### 6.2 Team & Workspace Management

**Goal:** Enhanced team collaboration and workspace management.

**Features:**
- [ ] Team creation and management
- [ ] Workspace-level permissions
- [ ] Team member invitations (email)
- [ ] Member activity tracking
- [ ] Workspace settings
- [ ] Team analytics

**Database Changes:**
- Update: `workspaces` (add team_id, settings)
- New table: `team_members` (team membership)
- New table: `invitations` (pending invitations)

**Backend:**
- Team management service
- Invitation service (email)
- Workspace settings API
- Member activity tracking

**Frontend:**
- Team management UI
- Invitation flow
- Workspace settings page
- Member activity dashboard

---

### 6.3 API Key Management

**Goal:** Allow users to create and manage API keys for programmatic access.

**Features:**
- [ ] API key generation
- [ ] API key scoping (permissions)
- [ ] API key expiration
- [ ] API key rotation
- [ ] API key usage tracking
- [ ] API key management UI

**Database Changes:**
- Update: `api_keys` table (already exists, needs implementation)
- New table: `api_key_usage` (usage tracking)

**Backend:**
- API key generation service
- API key authentication middleware
- API key scoping logic
- Usage tracking

**Frontend:**
- API key management page
- API key creation form
- Usage statistics display

---

### 6.4 Audit Logging

**Goal:** Comprehensive audit trail for security and compliance.

**Features:**
- [ ] Action logging (create, update, delete, execute)
- [ ] User activity tracking
- [ ] Resource change history
- [ ] Audit log filtering and search
- [ ] Audit log export
- [ ] Compliance reporting

**Database Changes:**
- Update: `audit_logs` table (already exists, needs implementation)
- Add indexes for performance

**Backend:**
- Audit logging service
- Audit log API routes
- Log filtering and search
- Export functionality

**Frontend:**
- Audit log viewer
- Filtering and search UI
- Export functionality
- Activity timeline

---

## Implementation Order

1. **6.1 Enhanced User Roles & Permissions** (Foundation)
2. **6.2 Team & Workspace Management** (Builds on 6.1)
3. **6.3 API Key Management** (Uses permissions from 6.1)
4. **6.4 Audit Logging** (Tracks all actions)

---

## Database Schema Changes

### New Tables

```sql
-- Custom Roles
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL, -- 'workflow', 'workspace', 'organization'
  action TEXT NOT NULL, -- 'read', 'write', 'execute', 'delete', 'admin'
  name TEXT NOT NULL,
  description TEXT
);

-- Role Permissions
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- Team Members
CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT REFERENCES roles(id),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Invitations
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  workspace_id TEXT REFERENCES workspaces(id),
  email TEXT NOT NULL,
  role_id TEXT REFERENCES roles(id),
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- API Key Usage
CREATE TABLE api_key_usage (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Updated Tables

```sql
-- Add role_id to organization_members
ALTER TABLE organization_members ADD COLUMN role_id TEXT REFERENCES roles(id);

-- Add indexes for audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## API Endpoints

### Roles & Permissions
- `GET /api/v1/roles` - List roles
- `POST /api/v1/roles` - Create role
- `GET /api/v1/roles/:id` - Get role
- `PUT /api/v1/roles/:id` - Update role
- `DELETE /api/v1/roles/:id` - Delete role
- `GET /api/v1/permissions` - List permissions
- `POST /api/v1/roles/:id/permissions` - Assign permissions to role
- `DELETE /api/v1/roles/:id/permissions/:permissionId` - Remove permission from role

### Teams & Invitations
- `GET /api/v1/teams` - List teams
- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams/:id` - Get team
- `PUT /api/v1/teams/:id` - Update team
- `DELETE /api/v1/teams/:id` - Delete team
- `POST /api/v1/invitations` - Send invitation
- `GET /api/v1/invitations` - List invitations
- `POST /api/v1/invitations/:token/accept` - Accept invitation
- `DELETE /api/v1/invitations/:id` - Cancel invitation

### API Keys
- `GET /api/v1/api-keys` - List API keys
- `POST /api/v1/api-keys` - Create API key
- `GET /api/v1/api-keys/:id` - Get API key
- `PUT /api/v1/api-keys/:id` - Update API key
- `DELETE /api/v1/api-keys/:id` - Delete API key
- `POST /api/v1/api-keys/:id/rotate` - Rotate API key
- `GET /api/v1/api-keys/:id/usage` - Get usage statistics

### Audit Logs
- `GET /api/v1/audit-logs` - List audit logs
- `GET /api/v1/audit-logs/:id` - Get audit log
- `GET /api/v1/audit-logs/export` - Export audit logs

---

## Frontend Pages

1. **Roles & Permissions Page** (`/settings/roles`)
   - Role list
   - Role creation/editing
   - Permission matrix
   - Role assignment

2. **Team Management Page** (`/settings/teams`)
   - Team list
   - Team creation/editing
   - Member management
   - Invitation management

3. **API Keys Page** (`/settings/api-keys`)
   - API key list
   - API key creation
   - Usage statistics
   - Key rotation

4. **Audit Logs Page** (`/settings/audit-logs`)
   - Audit log viewer
   - Filtering and search
   - Export functionality

---

## Security Considerations

1. **Permission Checks:**
   - All API endpoints must check permissions
   - Frontend should hide unauthorized actions
   - Backend must validate all permissions

2. **API Key Security:**
   - Keys stored hashed (never plain text)
   - Rate limiting per API key
   - IP whitelisting (optional)
   - Key rotation enforcement

3. **Audit Logging:**
   - Log all sensitive actions
   - Immutable logs (append-only)
   - Secure log storage
   - Access control for log viewing

---

## Testing Requirements

1. **Unit Tests:**
   - Permission evaluation logic
   - Role management
   - API key generation
   - Audit logging

2. **Integration Tests:**
   - Permission enforcement in API
   - Team invitation flow
   - API key authentication
   - Audit log creation

3. **E2E Tests:**
   - Role assignment flow
   - Team management flow
   - API key creation and usage
   - Audit log viewing

---

## Success Criteria

- [ ] Users can create custom roles with specific permissions
- [ ] Permissions are enforced on all API endpoints
- [ ] Teams can be created and managed
- [ ] Invitations can be sent and accepted
- [ ] API keys can be created and used for authentication
- [ ] All actions are logged in audit trail
- [ ] Audit logs can be filtered and exported
- [ ] UI reflects user permissions correctly

---

## Dependencies

- Existing multi-tenant architecture
- Clerk authentication (already integrated)
- Email service (for invitations)
- Database (PostgreSQL/Supabase)

---

## Estimated Timeline

- **6.1 Enhanced User Roles & Permissions:** 3-4 days
- **6.2 Team & Workspace Management:** 2-3 days
- **6.3 API Key Management:** 2-3 days
- **6.4 Audit Logging:** 2-3 days

**Total:** ~10-13 days

---

**Ready to Start:** ✅ Yes  
**Blockers:** None  
**Next Steps:** Begin with Section 6.1 (Enhanced User Roles & Permissions)

