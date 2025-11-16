# Dashboard Expectations - What You Should See

**Date:** 2024-11-10  
**After Phase 1 Implementation**

---

## Dashboard Overview

After logging in, you'll be redirected to the **Dashboard** page (`/`) which displays real-time statistics about your workflows and executions.

---

## What You'll See

### 1. Page Header
- **Title:** "Dashboard" (large, bold heading at the top)

### 2. Statistics Cards (3 Cards in a Grid)

The dashboard displays **3 statistics cards** in a responsive grid layout:

#### Card 1: **Total Workflows**
- **Label:** "Total Workflows"
- **Value:** Number of all workflows you've created
- **Data Source:** Counts all workflows in your organization(s)
- **Example:** `5` (if you have 5 workflows)

#### Card 2: **Executions Today**
- **Label:** "Executions Today"
- **Value:** Number of workflow executions that started today (since midnight)
- **Data Source:** Counts executions from `workflow_executions` table where `startedAt >= today 00:00:00`
- **Example:** `12` (if you ran workflows 12 times today)

#### Card 3: **Success Rate**
- **Label:** "Success Rate"
- **Value:** Percentage of successful workflow executions in the last 7 days
- **Calculation:** `(Completed Executions / Total Executions) × 100`
- **Data Source:** 
  - Total executions in last 7 days
  - Successful executions (status = 'completed') in last 7 days
- **Display Format:** 
  - If > 0: Shows as percentage (e.g., `95%`)
  - If 0: Shows as `-` (dash)
- **Example:** `95%` (if 95 out of 100 executions succeeded)

---

## Loading States

### While Loading
- All three cards show `...` (three dots) while fetching data
- Cards are still visible but values are loading

### After Loading
- Real numbers appear from the database
- If no data exists, shows `0` or `-` (for success rate)

---

## Data Behavior

### For New Users (No Data Yet)
```
Total Workflows: 0
Executions Today: 0
Success Rate: -
```

### After Creating Workflows
```
Total Workflows: 3
Executions Today: 0  (if you haven't run any today)
Success Rate: -      (if no executions in last 7 days)
```

### After Running Workflows
```
Total Workflows: 3
Executions Today: 5  (if you ran 5 workflows today)
Success Rate: 100%   (if all 5 succeeded)
```

### With Mixed Results
```
Total Workflows: 10
Executions Today: 8
Success Rate: 87%    (if 7 out of 8 succeeded in last 7 days)
```

---

## What the Statistics Include

### Total Workflows
- ✅ Counts **all workflows** you have access to
- ✅ Includes both **active** and **inactive** workflows
- ✅ Only shows workflows in **your organization(s)**
- ✅ Updates immediately when you create/delete workflows

### Executions Today
- ✅ Counts executions that **started** today (since midnight)
- ✅ Includes all execution statuses (running, completed, failed, etc.)
- ✅ Only shows executions for **your workflows**
- ✅ Resets at midnight each day

### Success Rate
- ✅ Calculated from **last 7 days** of executions
- ✅ Only counts executions with status = `'completed'` as successful
- ✅ Failed, cancelled, or running executions are not counted as successful
- ✅ Shows `-` if no executions in last 7 days
- ✅ Updates as new executions complete

---

## Technical Details

### API Endpoint
- **Endpoint:** `GET /api/v1/stats`
- **Authentication:** Required (Bearer token)
- **Response Format:**
```json
{
  "totalWorkflows": 5,
  "activeWorkflows": 4,
  "executionsToday": 12,
  "successRate": 95
}
```

### Data Filtering
- ✅ Statistics are **scoped to your organization(s)**
- ✅ You only see data for workflows you have access to
- ✅ Multi-tenant isolation is enforced

### Real-Time Updates
- ⚠️ Statistics **do not auto-refresh** (static on page load)
- ✅ Refresh the page to see updated statistics
- ✅ Statistics update when you:
  - Create a new workflow
  - Execute a workflow
  - Delete a workflow

---

## Visual Layout

```
┌─────────────────────────────────────────────────┐
│  Dashboard                                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │ Total        │  │ Executions   │  │ Success││
│  │ Workflows    │  │ Today        │  │ Rate   ││
│  │              │  │              │  │        ││
│  │      5       │  │     12       │  │  95%   ││
│  └──────────────┘  └──────────────┘  └────────┘│
│                                                 │
└─────────────────────────────────────────────────┘
```

### Card Styling
- **Background:** White cards with shadow
- **Layout:** Responsive grid (1 column on mobile, 3 columns on desktop)
- **Spacing:** 6-unit gap between cards
- **Typography:** 
  - Label: Medium weight, smaller text
  - Value: Bold, large text (3xl size)

---

## Common Scenarios

### Scenario 1: Brand New Account
**What you see:**
- Total Workflows: `0`
- Executions Today: `0`
- Success Rate: `-`

**What to do:**
1. Click "Workflows" in navigation
2. Create your first workflow
3. Return to Dashboard - Total Workflows will show `1`

### Scenario 2: After Creating Workflows
**What you see:**
- Total Workflows: `3` (your workflows)
- Executions Today: `0` (haven't run any today)
- Success Rate: `-` (no executions yet)

**What to do:**
1. Go to a workflow
2. Click "Run" button
3. Return to Dashboard - Executions Today will show `1`

### Scenario 3: Active User
**What you see:**
- Total Workflows: `10`
- Executions Today: `25` (busy day!)
- Success Rate: `96%` (most workflows succeed)

**This indicates:**
- You have 10 workflows set up
- You've run workflows 25 times today
- 96% of your executions in the last week succeeded

---

## Troubleshooting

### If You See All Zeros
- ✅ **Normal** if you're a new user
- ✅ Create some workflows first
- ✅ Run some workflows to see execution data

### If Success Rate Shows `-`
- ✅ **Normal** if you have no executions in the last 7 days
- ✅ Run some workflows to see success rate
- ✅ Success rate only calculates from last 7 days

### If Statistics Don't Update
- ✅ **Refresh the page** - statistics load on page load
- ✅ Statistics are not real-time (they update on page refresh)
- ✅ Check browser console for any errors

### If You See Loading Forever (`...`)
- ⚠️ Check if backend server is running
- ⚠️ Check if you're authenticated
- ⚠️ Check browser console for API errors
- ⚠️ Verify `/api/v1/stats` endpoint is accessible

---

## What's New in Phase 1

### Before Phase 1
- ❌ Dashboard had hardcoded `0` for executions
- ❌ Success rate was calculated incorrectly
- ❌ No real database queries

### After Phase 1
- ✅ **Real database statistics** from actual workflows
- ✅ **Accurate execution counts** from database
- ✅ **Proper success rate calculation** from last 7 days
- ✅ **Multi-tenant filtering** - only your organization's data
- ✅ **New `/api/v1/stats` endpoint** with proper queries

---

## Next Steps

1. **Login** to your account
2. **Navigate** to Dashboard (should be default after login)
3. **Create workflows** to see Total Workflows increase
4. **Run workflows** to see Executions Today increase
5. **Check success rate** after running multiple workflows

---

**Last Updated:** 2024-11-10  
**Phase:** Phase 1 - Logic Nodes ✅ Complete

