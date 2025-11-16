# Testing Guide

**Date:** December 2024  
**Status:** Complete

---

## Overview

This guide provides instructions for running end-to-end tests to verify all frontend-backend integrations.

---

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend
   npm run dev
   ```
   The server should be running on `http://localhost:4000`

2. **Database Setup**
   - Ensure database is configured and migrations are applied
   - Test data should be available (or tests will skip endpoints that require data)

3. **Environment Variables**
   - Set `API_URL` if backend is running on a different URL
   - Set `TEST_EMAIL` and `TEST_PASSWORD` for authentication tests (optional)

---

## Running Tests

### 1. API Endpoints Integration Test

This test script verifies all API endpoints are accessible and responding correctly.

```bash
cd backend
npm run test:api-endpoints
```

**What it tests:**
- ✅ Dashboard endpoints (`/stats`, `/stats/trends`, `/stats/chart`, etc.)
- ✅ Analytics endpoints (`/analytics/workflows`, `/analytics/nodes`, etc.)
- ✅ Workflows endpoints (`/workflows`)
- ✅ Alerts endpoints (`/alerts`)
- ✅ Code Agents endpoints (`/code-agents`)
- ✅ Preferences endpoints (`/users/me`, `/users/me/preferences`)
- ✅ Activity Log endpoints (`/users/me/activity`)
- ✅ Teams endpoints (`/teams`)
- ✅ Roles endpoints (`/roles`)
- ✅ API Keys endpoints (`/api-keys`)
- ✅ Audit Logs endpoints (`/audit-logs`, `/audit-logs/:id`, `/audit-logs/export/csv`)
- ✅ Email Trigger Monitoring endpoints (`/email-triggers/monitoring/*`)
- ✅ Performance Monitoring endpoints (`/monitoring/performance/*`)
- ✅ OSINT Monitoring endpoints (`/osint/*`)
- ✅ Connectors endpoints (`/connectors`)
- ✅ Agents endpoints (`/agents/frameworks`)
- ✅ Templates endpoints (`/templates`)
- ✅ Contact endpoint (`/contact`)

**Expected Output:**
```
🚀 Starting API Endpoints Integration Tests...
📍 API Base URL: http://localhost:4000/api/v1

📊 Testing Dashboard Endpoints...
✅ Passed: 45
❌ Failed: 0
⏭️  Skipped: 3
📊 Total: 48

⏱️  Average Response Time: 125.50ms
```

**Note:** Some endpoints may be skipped if they require specific data or authentication. This is expected.

---

## Manual Testing

### 1. Test Dashboard

1. Navigate to `http://localhost:3000/dashboard`
2. Verify all metrics load correctly
3. Check that charts display data
4. Verify recent workflows list appears

**Expected:**
- All stats cards show data
- Charts render correctly
- No console errors

### 2. Test Analytics

1. Navigate to `http://localhost:3000/dashboard/analytics`
2. Switch between different tabs (Workflows, Nodes, Costs, Errors, Usage)
3. Verify data loads for each tab
4. Test date range filters

**Expected:**
- All tabs load data
- Charts render correctly
- Filters work as expected

### 3. Test Workflows

1. Navigate to `http://localhost:3000/dashboard/workflows`
2. Verify workflows list loads
3. Test search functionality
4. Test tag filtering
5. Test workflow actions (duplicate, delete)

**Expected:**
- Workflows list displays
- Search works
- Filters work
- Actions complete successfully

### 4. Test Code Agents (Sandbox Studio)

1. Navigate to `http://localhost:3000/dashboard/sandbox`
2. Create a new code agent
3. Test code execution
4. Test code review
5. Test code suggestions
6. Test escape detection

**Expected:**
- Agent creation works
- Code executes successfully
- Review and suggestions work
- Escape detection functions

### 5. Test Audit Logs

1. Navigate to `http://localhost:3000/dashboard/settings/audit-logs`
2. Verify logs list loads
3. Test filtering (date range, action, resource type, etc.)
4. Test search functionality
5. Test CSV export
6. Test log detail view

**Expected:**
- Logs list displays
- All filters work
- Search works
- CSV export downloads file
- Detail view shows log information

### 6. Test Email Trigger Monitoring

1. Navigate to `http://localhost:3000/dashboard/monitoring/email-triggers`
2. Verify health summary loads
3. Test different views (Overview, Health, Alerts, Metrics)
4. Verify data refreshes automatically

**Expected:**
- Health summary displays
- All views load data
- Auto-refresh works

### 7. Test Performance Monitoring

1. Navigate to `http://localhost:3000/dashboard/monitoring/performance`
2. Verify metrics load
3. Test different views (Overview, Endpoints, System, Cache)
4. Check response times

**Expected:**
- Metrics display correctly
- All views load data
- Response times are reasonable

### 8. Test OSINT Monitoring

1. Navigate to `http://localhost:3000/dashboard/monitoring/osint`
2. Verify monitors list loads
3. Test creating a monitor
4. Test viewing results
5. Test statistics

**Expected:**
- Monitors list displays
- Monitor creation works
- Results display correctly
- Statistics show data

---

## Browser Testing

### Using Browser DevTools

1. **Open Browser DevTools** (F12)
2. **Navigate to Network Tab**
3. **Visit each page** and verify:
   - All API calls return 200 status
   - No 404 or 500 errors
   - Response times are reasonable (< 1 second)
   - Data is returned in expected format

### Common Issues to Check

1. **CORS Errors**
   - Verify `CORS_ORIGIN` is set correctly in backend `.env`
   - Check browser console for CORS errors

2. **Authentication Errors**
   - Verify token is being sent in Authorization header
   - Check if token is expired
   - Verify Clerk configuration

3. **404 Errors**
   - Verify endpoint exists in backend
   - Check route path matches frontend call
   - Verify route is registered in `backend/src/index.ts`

4. **500 Errors**
   - Check backend logs for error details
   - Verify database connection
   - Check environment variables

---

## API Documentation Testing

### Access Swagger UI

1. Start backend server
2. Navigate to `http://localhost:4000/api-docs`
3. Verify all endpoints are documented
4. Test endpoints directly from Swagger UI

### Verify Documentation

- ✅ All endpoints have descriptions
- ✅ Request/response schemas are defined
- ✅ Authentication requirements are documented
- ✅ Error responses are documented
- ✅ Query parameters are documented

---

## Test Results

### Expected Results

After running all tests, you should see:

- ✅ **90%+ endpoints passing** (some may skip if no data)
- ✅ **No critical failures** (404s, 500s)
- ✅ **Response times < 1 second** for most endpoints
- ✅ **All frontend pages load** without errors
- ✅ **All API calls succeed** in browser Network tab

### Known Limitations

1. **Authentication**: Some tests may skip if authentication is not configured
2. **Data Dependencies**: Some endpoints may return empty results if no data exists
3. **Rate Limiting**: Tests may be rate-limited if run too frequently

---

## Continuous Testing

### Recommended Testing Schedule

- **Before Deployment**: Run full test suite
- **After Code Changes**: Run relevant test subset
- **Weekly**: Run full integration tests
- **After Database Migrations**: Verify all endpoints still work

### Automated Testing (Future)

Consider setting up:
- CI/CD pipeline with automated tests
- E2E tests with Playwright/Cypress
- Load testing for performance validation
- Security testing for vulnerability scanning

---

## Troubleshooting

### Tests Failing

1. **Check Backend Logs**
   ```bash
   cd backend
   npm run dev
   # Watch for errors in console
   ```

2. **Verify Database Connection**
   ```bash
   # Check database is accessible
   # Verify migrations are applied
   ```

3. **Check Environment Variables**
   ```bash
   # Verify all required env vars are set
   # Check .env file exists
   ```

4. **Verify Routes are Registered**
   ```bash
   # Check backend/src/index.ts
   # Verify all routes are imported and registered
   ```

### Common Fixes

- **404 Errors**: Add missing route to `backend/src/index.ts`
- **500 Errors**: Check backend logs, verify database queries
- **CORS Errors**: Update `CORS_ORIGIN` in backend `.env`
- **Auth Errors**: Verify Clerk configuration and token format

---

## Next Steps

1. ✅ Run API endpoints test: `npm run test:api-endpoints`
2. ✅ Manual test all frontend pages
3. ✅ Verify Swagger documentation at `/api-docs`
4. ✅ Check browser Network tab for errors
5. ✅ Review test results and fix any issues

---

## Status

- ✅ Test script created
- ✅ API documentation updated
- ✅ Testing guide created
- ⏳ Ready for execution

