# Alert System Testing Guide

This guide provides step-by-step instructions for testing the alert system.

---

## Prerequisites

1. Backend server running on port 4000
2. Frontend server running on port 3000
3. Database connected and migrations applied
4. User logged in to the platform

---

## Test 1: Create a Failure Alert

### Via API (Direct Test)

```bash
# Get your auth token first (from browser dev tools or login response)
TOKEN="your-auth-token"

# Create a failure alert
curl -X POST http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Workflow Failure Alert",
    "description": "Alert when workflow fails",
    "type": "failure",
    "conditions": [
      {
        "metric": "failure_rate",
        "operator": ">",
        "threshold": 10,
        "timeWindow": 60
      }
    ],
    "notificationChannels": [
      {
        "type": "email",
        "config": {
          "email": "test@example.com"
        }
      }
    ],
    "cooldownMinutes": 60
  }'
```

### Via UI

1. Navigate to `/alerts` page
2. Click "Create Alert" button
3. Fill in the form:
   - Name: "Workflow Failure Alert"
   - Type: "Failure"
   - Condition: Failure Rate > 10%
   - Notification: Email (test@example.com)
   - Cooldown: 60 minutes
4. Click "Save"

**Expected Result:** Alert created successfully

---

## Test 2: Create a Performance Alert

### Via API

```bash
curl -X POST http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slow Workflow Alert",
    "description": "Alert when workflow takes too long",
    "type": "performance",
    "conditions": [
      {
        "metric": "execution_time",
        "operator": ">",
        "threshold": 5000
      }
    ],
    "notificationChannels": [
      {
        "type": "slack",
        "config": {
          "slackWebhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
        }
      }
    ],
    "cooldownMinutes": 30
  }'
```

**Expected Result:** Performance alert created

---

## Test 3: Create a Usage Alert

### Via API

```bash
curl -X POST http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Usage Alert",
    "description": "Alert when usage exceeds threshold",
    "type": "usage",
    "conditions": [
      {
        "metric": "usage_count",
        "operator": ">",
        "threshold": 100,
        "timeWindow": 60
      }
    ],
    "notificationChannels": [
      {
        "type": "webhook",
        "config": {
          "webhookUrl": "https://your-webhook-endpoint.com/alerts"
        }
      }
    ],
    "cooldownMinutes": 120
  }'
```

**Expected Result:** Usage alert created

---

## Test 4: List All Alerts

### Via API

```bash
curl -X GET http://localhost:4000/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN"
```

### Via UI

1. Navigate to `/alerts` page
2. View list of all alerts

**Expected Result:** All alerts for your organization are displayed

---

## Test 5: Toggle Alert

### Via API

```bash
# Disable alert
curl -X PATCH http://localhost:4000/api/v1/alerts/{alertId}/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Enable alert
curl -X PATCH http://localhost:4000/api/v1/alerts/{alertId}/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Via UI

1. Navigate to `/alerts` page
2. Click "Disable" or "Enable" button on an alert

**Expected Result:** Alert status toggled

---

## Test 6: View Alert History

### Via API

```bash
curl -X GET http://localhost:4000/api/v1/alerts/{alertId}/history \
  -H "Authorization: Bearer $TOKEN"
```

### Via UI

1. Navigate to `/alerts` page
2. Click "History" button on an alert
3. View alert trigger history

**Expected Result:** Alert history displayed

---

## Test 7: Test Alert Triggering

### Setup

1. Create a workflow
2. Create an alert with a low threshold (e.g., failure_rate > 0%)
3. Execute the workflow multiple times, ensuring some fail

### Trigger Failure Alert

1. Execute a workflow that will fail
2. Check alert history
3. Verify notification was sent (check email/Slack/webhook)

**Expected Result:** 
- Alert triggered in history
- Notification sent via configured channel

### Trigger Performance Alert

1. Create a workflow that takes longer than threshold
2. Execute the workflow
3. Check alert history

**Expected Result:** Performance alert triggered

---

## Test 8: Test Notification Channels

### Email Notifications

**Prerequisites:** Configure SMTP in `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@sos-platform.com
```

1. Create alert with email notification
2. Trigger the alert
3. Check email inbox

**Expected Result:** Email received with alert details

### Slack Notifications

1. Create a Slack webhook URL (https://api.slack.com/messaging/webhooks)
2. Create alert with Slack notification
3. Trigger the alert
4. Check Slack channel

**Expected Result:** Slack message received

### Webhook Notifications

1. Set up a test webhook endpoint (e.g., using webhook.site)
2. Create alert with webhook notification
3. Trigger the alert
4. Check webhook endpoint logs

**Expected Result:** Webhook POST request received with alert data

---

## Test 9: Test Cooldown

1. Create an alert with 1-minute cooldown
2. Trigger the alert (should send notification)
3. Trigger again within cooldown period (should NOT send)
4. Wait for cooldown to expire
5. Trigger again (should send notification)

**Expected Result:** 
- First trigger: notification sent
- Second trigger (within cooldown): no notification
- Third trigger (after cooldown): notification sent

---

## Test 10: Test Workflow-Specific Alerts

1. Create an alert for a specific workflow
2. Execute that workflow (should check alert)
3. Execute a different workflow (should NOT check alert)

**Expected Result:** 
- Alert only checked for specified workflow
- Other workflows don't trigger the alert

---

## Test 11: Test Alert Integration with Workflow Execution

1. Create a workflow
2. Create an alert for that workflow
3. Execute the workflow (success)
4. Check alert history (should check but not trigger if conditions not met)
5. Execute workflow to fail
6. Check alert history (should trigger if conditions met)

**Expected Result:** 
- Alerts checked after each execution
- Alerts trigger when conditions are met
- Alert checking doesn't block workflow execution

---

## Troubleshooting

### Alerts Not Triggering

1. Check alert is enabled
2. Check alert conditions are correct
3. Check cooldown period hasn't expired
4. Check workflow execution status
5. Check alert service logs

### Notifications Not Sending

1. **Email:** Check SMTP configuration
2. **Slack:** Verify webhook URL is correct
3. **Webhook:** Check webhook endpoint is accessible
4. Check alert service logs for errors

### Database Issues

1. Verify migrations are applied: `npm run db:migrate`
2. Check database connection
3. Verify alert tables exist

---

## API Endpoints Summary

- `GET /api/v1/alerts` - List all alerts
- `GET /api/v1/alerts/:id` - Get alert details
- `POST /api/v1/alerts` - Create alert
- `PUT /api/v1/alerts/:id` - Update alert
- `DELETE /api/v1/alerts/:id` - Delete alert
- `PATCH /api/v1/alerts/:id/toggle` - Toggle alert
- `GET /api/v1/alerts/:id/history` - Get alert history

---

## Test Checklist

- [ ] Create failure alert
- [ ] Create performance alert
- [ ] Create usage alert
- [ ] List alerts
- [ ] Toggle alert
- [ ] View alert history
- [ ] Trigger failure alert
- [ ] Trigger performance alert
- [ ] Test email notifications
- [ ] Test Slack notifications
- [ ] Test webhook notifications
- [ ] Test cooldown
- [ ] Test workflow-specific alerts
- [ ] Test alert integration with workflow execution

---

**Last Updated:** 2024-11-10

