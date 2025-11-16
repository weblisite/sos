# Email Triggers Multi-Tenant Architecture

## How Gmail/Outlook OAuth Works in a SaaS Platform

### ✅ **Each User Connects Their OWN Account**

In a multi-tenant SaaS platform, **each user connects their own Gmail or Outlook account** via OAuth. They do NOT share credentials.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your SaaS Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User A (alice@company.com)                                  │
│  ├─ Workflow 1: Monitors alice@gmail.com                     │
│  └─ OAuth Credentials: Stored per user/workflow              │
│                                                               │
│  User B (bob@company.com)                                    │
│  ├─ Workflow 1: Monitors bob@outlook.com                     │
│  └─ OAuth Credentials: Stored per user/workflow              │
│                                                               │
│  User C (charlie@company.com)                                │
│  ├─ Workflow 1: Monitors charlie@gmail.com                   │
│  └─ OAuth Credentials: Stored per user/workflow              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

1. **OAuth App Registration (One-Time Setup)**
   - You create ONE OAuth app in Google Cloud Console / Microsoft Azure
   - This gives you `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` (shared across all users)
   - These are stored as environment variables on your backend

2. **User OAuth Flow (Per User)**
   - User A clicks "Connect Gmail" in your platform
   - They're redirected to Google's OAuth consent screen
   - User A authorizes YOUR app to access THEIR Gmail account
   - Google returns an access token + refresh token for User A's account
   - These tokens are stored in the `email_triggers` table with `userId = User A's ID`

3. **Credential Storage**
   ```sql
   email_triggers table:
   - id: unique trigger ID
   - user_id: User A's ID (links to users table)
   - workflow_id: Workflow ID
   - email: alice@gmail.com
   - credentials: { accessToken: "...", refreshToken: "..." }  -- User A's tokens
   ```

4. **Polling**
   - Backend polls Gmail API using User A's access token
   - Each user's triggers are polled independently
   - Credentials are isolated per user

### Database Schema

```typescript
emailTriggers table:
- userId: text (NOT NULL) - Links to the user who owns this trigger
- organizationId: text (optional) - Links to organization
- workflowId: text (NOT NULL) - Links to workflow
- email: text (NOT NULL) - The email address being monitored
- credentials: jsonb (NOT NULL) - OAuth tokens (stored per user)
```

### Security & Isolation

✅ **User Isolation**: Each user's credentials are stored separately  
✅ **Workflow Isolation**: Each workflow has its own trigger configuration  
✅ **Organization Isolation**: Triggers can be scoped to organizations  
✅ **Token Refresh**: Each user's refresh token is used independently  

### Example Flow

1. **User A creates a workflow with Gmail trigger**
   - Frontend calls `GET /api/v1/email-oauth/gmail/authorize`
   - Backend returns OAuth URL with `state` containing `userId: User A's ID`

2. **User A authorizes on Google**
   - Google redirects to `/api/v1/email-oauth/gmail/callback?code=...&state=...`
   - Backend exchanges code for tokens
   - Tokens are associated with User A's ID

3. **Workflow is saved**
   - Frontend includes credentials in workflow node config
   - Backend calls `updateEmailTriggerRegistry()`
   - Credentials are stored in `email_triggers` table with `userId = User A's ID`

4. **Polling starts**
   - Backend polls Gmail API using User A's access token
   - New emails trigger User A's workflow
   - User B's workflows are completely separate

### Why This Works

- **OAuth App**: One app, many users (standard OAuth pattern)
- **Access Tokens**: Each user gets their own tokens
- **Database**: Credentials stored per user/workflow
- **Polling**: Each trigger uses its own credentials

### Important Notes

1. **OAuth Client ID/Secret**: Shared across all users (stored in env vars)
2. **Access Tokens**: Unique per user (stored in database)
3. **Refresh Tokens**: Used to get new access tokens when they expire
4. **Token Expiry**: Access tokens expire, refresh tokens are used to get new ones

### Future Enhancement: Token Refresh

Currently, if an access token expires, the trigger will fail. You should implement:
- Token refresh logic using refresh tokens
- Automatic retry when tokens expire
- User notification when re-authorization is needed

