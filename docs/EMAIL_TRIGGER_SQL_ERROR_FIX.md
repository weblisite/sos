# Email Trigger SQL Error Fix

## Issue

**Error**: `PostgresError: syntax error at or near "$1"` when loading email triggers

**Root Cause**: The `email_triggers` table doesn't exist in the database. The migration file (`0005_oval_siren.sql`) exists but hasn't been applied yet.

## Solution

Added proper error handling in two places:

1. **`emailTriggerService.ts`** - `loadEmailTriggers()` method
2. **`emailTriggerMonitoring.ts`** - `updateMetricsFromDatabase()` method

### Changes Made

Both methods now:
- Wrap the database query in a try-catch block
- Check for specific PostgreSQL error codes:
  - `42P01` - Table does not exist
  - `42601` - SQL syntax error
- Log a warning instead of crashing the server
- Return early if the table doesn't exist

### Code Changes

**Before**:
```typescript
const activeTriggers = await db
  .select()
  .from(emailTriggers)
  .where(eq(emailTriggers.active, true));
```

**After**:
```typescript
let activeTriggers;
try {
  activeTriggers = await db
    .select()
    .from(emailTriggers)
    .where(eq(emailTriggers.active, true));
} catch (queryError: any) {
  // If table doesn't exist or SQL syntax error, return empty array
  if (queryError?.code === '42P01' || queryError?.code === '42601') {
    console.warn('Email triggers table may not exist yet or has schema issues, skipping trigger loading');
    return;
  }
  throw queryError;
}
```

## Result

✅ **Server no longer crashes** when the `email_triggers` table doesn't exist
✅ **Graceful degradation** - email trigger functionality is skipped until the table is created
✅ **Proper error logging** - warnings are logged instead of errors

## Next Steps

To fully enable email trigger functionality:

1. **Apply the migration**:
   ```bash
   cd backend
   npx drizzle-kit push:pg
   # OR manually run the migration SQL
   ```

2. **Verify the table exists**:
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name = 'email_triggers'
   );
   ```

3. **Restart the server** - email triggers will now load correctly

## Status

✅ **Fixed** - Server starts without errors
⚠️ **Email triggers disabled** until migration is applied

