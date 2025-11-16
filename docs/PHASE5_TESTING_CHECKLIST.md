# Phase 5 Testing Checklist

**Date:** 2024-12-19  
**Status:** 🧪 **TESTING READY**

---

## Pre-Testing Setup

### Environment Variables
- [ ] `NANGO_SECRET_KEY` configured
- [ ] `NANGO_HOST` configured
- [ ] Backend server running on port 4000
- [ ] Frontend server running on port 3000
- [ ] Database connection verified

---

## Unit Tests

### Connector Registry
- [ ] Test connector registration
- [ ] Test connector retrieval by ID
- [ ] Test connector listing with category filter
- [ ] Test custom connector registration
- [ ] Test connector versioning
- [ ] Test connector update
- [ ] Test connector unregistration
- [ ] Test built-in connector protection

---

## Integration Tests

### API Endpoints
- [ ] `GET /api/connectors` - List all connectors
- [ ] `GET /api/connectors?category=crm` - Filter by category
- [ ] `GET /api/connectors/:id` - Get connector by ID
- [ ] `GET /api/connectors/connections` - Get connection statuses
- [ ] `POST /api/connectors/:id/connect` - Initiate OAuth flow
- [ ] `POST /api/connectors/:id/disconnect` - Disconnect connector
- [ ] `POST /api/connectors/register` - Register custom connector
- [ ] `PUT /api/connectors/:id` - Update connector
- [ ] `DELETE /api/connectors/:id` - Unregister custom connector

### OAuth Flow
- [ ] Test Nango OAuth initiation
- [ ] Test OAuth callback handling
- [ ] Test token refresh
- [ ] Test connection status tracking

---

## Frontend Tests

### Connector Marketplace UI
- [ ] Page loads correctly
- [ ] Connectors display in grid
- [ ] Search functionality works
- [ ] Category filtering works
- [ ] Connection status displays correctly
- [ ] Connect button initiates OAuth
- [ ] Disconnect button removes connection
- [ ] Empty state displays when no results
- [ ] Loading states display correctly
- [ ] Error handling works

---

## End-to-End Tests

### Connector Workflow
1. [ ] Navigate to `/dashboard/connectors`
2. [ ] Search for "Slack"
3. [ ] Click "Connect" button
4. [ ] Complete OAuth flow
5. [ ] Verify connection status updates
6. [ ] Use connector in workflow
7. [ ] Execute workflow with connector
8. [ ] Verify connector action executes
9. [ ] Disconnect connector
10. [ ] Verify connection removed

### Custom Connector
1. [ ] Register custom connector via API
2. [ ] Verify connector appears in marketplace
3. [ ] Update connector version
4. [ ] Verify version updated
5. [ ] Unregister connector
6. [ ] Verify connector removed

---

## Performance Tests

- [ ] Load time for connector list (< 1s)
- [ ] Search response time (< 200ms)
- [ ] Filter response time (< 100ms)
- [ ] OAuth initiation time (< 500ms)
- [ ] Connection status check (< 200ms)

---

## Security Tests

- [ ] Authentication required for all endpoints
- [ ] Built-in connectors cannot be deleted
- [ ] Custom connectors can be deleted
- [ ] Credentials encrypted in database
- [ ] OAuth tokens stored securely
- [ ] Audit logs created for all operations

---

## Browser Compatibility

- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile responsive

---

## Test Results

**Date:** _____________  
**Tester:** _____________  
**Status:** ⬜ Pass / ⬜ Fail / ⬜ Partial

**Notes:**
_________________________________________________
_________________________________________________
_________________________________________________

---

**Last Updated:** 2024-12-19

