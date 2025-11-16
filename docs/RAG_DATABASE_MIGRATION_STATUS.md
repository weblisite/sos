# RAG Database Migration Status

## Date: 2024-12-19

---

## ✅ Database Connection

**Yes, the PostgreSQL database is Supabase.**

The database configuration (`backend/src/config/database.ts`) shows:
- Uses `DATABASE_URL` environment variable
- Connection string points to Supabase: `aws-1-us-west-1.pooler.supabase.com`
- Project reference: `qgfututvkhhsjbjthkammv`

---

## ✅ Migration Status

**Migration has been generated and is ready to apply.**

### Migration File Created

**File**: `backend/drizzle/migrations/0006_stale_bromley.sql`

**Contains**:
- `vector_indexes` table creation
- `vector_documents` table creation
- Foreign key constraints
- Proper indexes and relationships

### Migration Status Check

When running `npx drizzle-kit up:pg`, the output shows:
```
Everything's fine 🐶🔥
```

This typically means:
- ✅ Migration file exists
- ✅ Schema is in sync with database
- ✅ **OR** migrations need to be applied

---

## ⚠️ Verification Needed

To confirm the migration was actually applied to Supabase, you should:

1. **Check Supabase Dashboard**:
   - Go to your Supabase project
   - Navigate to Table Editor
   - Look for `vector_indexes` and `vector_documents` tables

2. **Or run a test query**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('vector_indexes', 'vector_documents');
   ```

---

## 🔧 How to Apply Migration (if not already applied)

If the tables don't exist in Supabase, you can apply the migration:

### Option 1: Using Drizzle Kit (Recommended)
```bash
cd backend
npx drizzle-kit push:pg
```

### Option 2: Manual SQL Execution
1. Open Supabase SQL Editor
2. Copy contents of `backend/drizzle/migrations/0006_stale_bromley.sql`
3. Execute the SQL

### Option 3: Using Drizzle Migrate
```bash
cd backend
npx drizzle-kit migrate
```

---

## 📋 Migration Details

### Tables Created

1. **vector_indexes**
   - Stores vector store index configurations
   - Multi-tenant support (organization_id)
   - Unique constraint on (organization_id, name)

2. **vector_documents**
   - Stores vector embeddings and documents
   - Links to vector_indexes via index_id
   - Multi-tenant support (organization_id)
   - Stores embeddings as JSONB array

### Foreign Keys

- `vector_documents.index_id` → `vector_indexes.id` (CASCADE DELETE)
- `vector_documents.organization_id` → `organizations.id` (CASCADE DELETE)
- `vector_indexes.organization_id` → `organizations.id` (CASCADE DELETE)

---

## ✅ Next Steps

1. **Verify tables exist in Supabase** (check dashboard or run SQL query)
2. **If tables don't exist**, apply migration using one of the methods above
3. **Test the RAG functionality** to ensure database persistence works

---

## 🔍 Quick Verification Query

Run this in Supabase SQL Editor to check if tables exist:

```sql
-- Check if vector store tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('vector_indexes', 'vector_documents');
```

Expected result: 2 rows (one for each table)

---

## 📝 Summary

- ✅ **Database**: Supabase PostgreSQL
- ✅ **Migration File**: Generated (`0006_stale_bromley.sql`)
- ⚠️ **Migration Applied**: Needs verification
- ✅ **Ready to Use**: Once migration is confirmed/applied

