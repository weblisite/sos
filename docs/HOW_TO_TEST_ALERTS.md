# How to Test Alerts - Quick Guide

Since the API requires authentication, here are the easiest ways to test the alert system:

---

## Option 1: Test via UI (Recommended - Easiest)

### Steps:

1. **Start the servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

2. **Login to the platform:**
   - Navigate to http://localhost:3000
   - Login with your credentials

3. **Navigate to Alerts page:**
   - Click "Alerts" in the sidebar
   - Or go directly to http://localhost:3000/alerts

4. **Create an alert:**
   - Click "Create Alert" button
   - Fill in the form:
     - **Name:** "Test Failure Alert"
     - **Type:** "Failure"
     - **Condition:** 
       - Metric: "Failure Rate (%)"
       - Operator: ">"
       - Threshold: "0" (will trigger on any failure)
     - **Notification Channel:**
       - Type: "Email"
       - Email: "your-email@example.com"
     - **Cooldown:** 60 minutes
   - Click "Save"

5. **Verify alert created:**
   - Alert should appear in the list
   - Status should show "Active"

6. **Test alert triggering:**
   - Create a simple workflow
   - Execute it and make it fail
   - Check alert history (click "History" button on the alert)
   - Verify alert was triggered

---

## Option 2: Test via API (Advanced)

### Get Your Auth Token:

1. **Open browser DevTools:**
   - Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Or right-click → Inspect

2. **Go to Network tab:**
   - Click on "Network" tab in DevTools

3. **Make a request:**
   - Navigate to http://localhost:3000/workflows
   - Or any page that makes API calls

4. **Find the token:**
   - Look for any request to `/api/v1/...`
   - Click on it
   - Go to "Headers" section
   - Find "Authorization" header
   - Copy the token (everything after "Bearer ")

5. **Use the token:**
   ```bash
   export TOKEN="your-actual-token-here"
   cd backend
   node test-alerts.js
   ```

---

## Option 3: Test Individual Endpoints with curl

Once you have your token:

```bash
# Set your token
export TOKEN="your-token-here"

# Create an alert
curl -X POST http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Alert",
    "type": "failure",
    "conditions": [{
      "metric": "failure_rate",
      "operator": ">",
      "threshold": 0
    }],
    "notificationChannels": [{
      "type": "email",
      "config": {
        "email": "test@example.com"
      }
    }]
  }'

# List alerts
curl -X GET http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN"

# Get alert history
curl -X GET http://localhost:4000/api/v1/alerts/{alertId}/history \
  -H "Authorization: Bearer $TOKEN"
```

---

## Quick Test Checklist

### Via UI:
- [ ] Navigate to `/alerts` page
- [ ] Create a failure alert
- [ ] Create a performance alert
- [ ] Toggle alert on/off
- [ ] View alert history
- [ ] Delete an alert

### Test Alert Triggering:
- [ ] Create a workflow
- [ ] Create an alert with low threshold
- [ ] Execute workflow to trigger alert
- [ ] Check alert history
- [ ] Verify notification (if configured)

### Test Notifications:
- [ ] Configure SMTP (for email)
- [ ] Create alert with email notification
- [ ] Trigger alert
- [ ] Check email inbox

---

## Troubleshooting

### "Invalid token" error:
- Make sure you copied the full token (it's a long string)
- Token should start with `eyJ` (JWT format)
- Token expires after some time - get a fresh one if needed

### Can't find Authorization header:
- Make sure you're logged in
- Check that you're looking at the right request
- Try refreshing the page and checking again

### Alert not triggering:
- Check alert is enabled
- Check alert conditions are correct
- Check cooldown period hasn't expired
- Check workflow execution status

---

## Recommended Testing Flow

1. **Start with UI testing** (easiest)
   - Create alerts via UI
   - Test basic functionality

2. **Test alert triggering**
   - Create test workflows
   - Execute them
   - Verify alerts trigger

3. **Test notifications** (if needed)
   - Configure SMTP/Slack/Webhook
   - Test notification delivery

---

**Tip:** The UI is the easiest way to test. Use API testing only if you need to automate or test specific scenarios.

