# OSINT Database Migration Guide

## Migration File
**Location**: `backend/drizzle/migrations/0009_rich_manta.sql`

## How to Apply Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Navigate to your Supabase project
   - Go to SQL Editor

2. **Copy Migration SQL**
   - Open `backend/drizzle/migrations/0009_rich_manta.sql`
   - Copy the entire contents

3. **Run Migration**
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter
   - Verify the migration completed successfully

4. **Verify Tables Created**
   ```sql
   -- Check if tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('osint_monitors', 'osint_results');
   
   -- Check if enums exist
   SELECT typname 
   FROM pg_type 
   WHERE typname IN ('osint_source', 'osint_monitor_status');
   ```

### Option 2: Using Drizzle Kit (If DATABASE_URL is set)

```bash
cd backend
npm run db:push
```

Or manually apply:
```bash
cd backend
npm run db:apply-migrations
```

### Option 3: Using psql Command Line

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration file
\i backend/drizzle/migrations/0009_rich_manta.sql
```

## What This Migration Creates

### Enums
- `osint_source`: twitter, reddit, news, forums, github, linkedin, youtube, web
- `osint_monitor_status`: active, paused, error, disabled

### Tables
1. **osint_monitors**
   - Stores OSINT monitor configurations
   - Links to organizations, workspaces, workflows, and alerts
   - Tracks status, schedule, filters, and statistics

2. **osint_results**
   - Stores collected OSINT data
   - Links to monitors and organizations
   - Includes sentiment analysis, metadata, and processing status

### Indexes
- Organization + status index on monitors
- Source + status index on monitors
- Next run time index for efficient polling
- Monitor + published date index on results
- Source + source ID index for deduplication
- Organization + collected date index on results
- Unprocessed results index for workflow processing

### Foreign Keys
- All tables properly linked with cascade deletes
- Referential integrity maintained

## Verification Queries

After migration, run these to verify:

```sql
-- Check table structure
\d osint_monitors
\d osint_results

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('osint_monitors', 'osint_results');

-- Check foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('osint_monitors', 'osint_results');
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Drop tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS osint_results CASCADE;
DROP TABLE IF EXISTS osint_monitors CASCADE;

-- Drop enums
DROP TYPE IF EXISTS osint_monitor_status;
DROP TYPE IF EXISTS osint_source;
```

## Troubleshooting

### Error: "relation already exists"
- Tables may already exist from a previous migration
- Check if tables exist before running migration
- Use `CREATE TABLE IF NOT EXISTS` (already in migration)

### Error: "type already exists"
- Enums may already exist
- Migration uses `DO $$ BEGIN ... EXCEPTION ... END $$` to handle this

### Error: "permission denied"
- Ensure your database user has CREATE TABLE and CREATE TYPE permissions
- Check Supabase project settings

## Post-Migration

After successful migration:
1. Restart the backend server
2. Verify OSINT service starts without errors
3. Test creating a monitor via the UI
4. Check logs for any warnings
