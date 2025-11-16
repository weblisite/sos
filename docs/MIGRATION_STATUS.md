# Database Migration Status

## Current Migration Files

The following migration files exist in `backend/drizzle/migrations/`:

1. ✅ `0000_classy_red_ghost.sql` - Initial schema
2. ✅ `0001_lame_triton.sql` - Schema updates
3. ✅ `0002_thick_thundra.sql` - Schema updates
4. ✅ `0003_swift_ma_gnuci.sql` - Schema updates
5. ✅ `0004_add_audit_logs_indexes.sql` - Audit log indexes
6. ✅ `0005_oval_siren.sql` - Schema updates
7. ✅ `0006_stale_bromley.sql` - Vector store tables
8. ✅ `0007_unknown_may_parker.sql` - Workflow templates table
9. ✅ `0008_add_vector_store_indexes.sql` - Vector store indexes (renamed from 0007)

**Note:** The duplicate migration number has been fixed. `0007_add_vector_store_indexes.sql` has been renamed to `0008_add_vector_store_indexes.sql`.

## How to Check Migration Status

### Option 1: Use the Verification Script

```bash
cd backend
npx tsx scripts/check-and-apply-migrations.ts
```

This script will:
- Check which migrations have been applied
- Show missing migrations
- Optionally apply missing migrations

### Option 2: Use Drizzle Kit

```bash
cd backend
npm run db:push
```

This will push the current schema to the database (may not track individual migrations).

### Option 3: Manual Check

Connect to your Supabase database and check:

```sql
-- Check if migrations table exists
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;

-- Check if specific tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

## How to Apply Migrations

### Recommended: Use the Apply All Migrations Script

```bash
cd backend
npx tsx scripts/apply-all-migrations.ts
```

This will:
1. Check current migration status
2. Apply any missing migrations in order
3. Record them in the migrations table
4. Handle "already exists" errors gracefully

### Alternative: Use Drizzle Kit Push

```bash
cd backend
npm run db:push
```

**Note:** `db:push` syncs the schema but may not track individual migrations in the migrations table.

### Manual Application

If you need to apply a specific migration manually:

```bash
cd backend
npx tsx scripts/apply-migration.ts
```

Or connect to Supabase and run the SQL directly.

## Migration Issues

### Duplicate Migration Number (0007)

There are two files with migration number `0007`:
- `0007_unknown_may_parker.sql` - Workflow templates (tracked in journal)
- `0007_add_vector_store_indexes.sql` - Vector store indexes (not tracked)

**Solution:**
1. The `0007_unknown_may_parker.sql` is the official one (tracked in journal)
2. The `0007_add_vector_store_indexes.sql` should be renamed to `0008_add_vector_store_indexes.sql`
3. Or manually apply the indexes if they're not already applied

### Checking if Indexes Exist

```sql
-- Check if vector store indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('vector_documents', 'vector_indexes')
AND schemaname = 'public';
```

## Required Tables

The following tables should exist after all migrations:

1. `users`
2. `organizations`
3. `organization_members`
4. `workspaces`
5. `workflows`
6. `workflow_versions`
7. `workflow_executions`
8. `execution_logs`
9. `workflow_templates` ⚠️ (from 0007)
10. `api_keys`
11. `audit_logs`
12. `alerts`
13. `alert_history`
14. `roles`
15. `permissions`
16. `role_permissions`
17. `teams`
18. `team_members`
19. `invitations`
20. `email_triggers`
21. `email_oauth_credentials`
22. `vector_indexes` ⚠️ (from 0006)
23. `vector_documents` ⚠️ (from 0006)
24. `webhook_registry`

## Next Steps

1. **Check migration status:**
   ```bash
   cd backend
   npx tsx scripts/check-and-apply-migrations.ts
   ```

2. **If migrations are missing, apply them:**
   The script will automatically apply missing migrations.

3. **Verify tables exist:**
   Check that all required tables are present in your Supabase database.

4. **Verify all migrations applied:**
   The script will show which migrations are applied and which are missing.

---

**Last Updated:** 2024-11-12

