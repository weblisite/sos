# Bug Fix: Edge Handle Validation Error

**Date:** 2024-11-10  
**Issue:** Workflow execution failing with Zod validation error for `targetHandle`

---

## Problem

When executing workflows, the following error occurred:

```
Error executing workflow: ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "null",
    "path": [
      "definition",
      "edges",
      3,
      "targetHandle"
    ],
    "message": "Expected string, received null"
  }
]
```

## Root Cause

React Flow can set `sourceHandle` and `targetHandle` to `null` when creating edges, especially for nodes with default handles. The Zod schema was using `.optional()` which allows `undefined` but not `null`.

## Solution

Updated the workflow schema in `shared/src/schemas/workflow.ts` to allow `null` values for handles:

```typescript
// Before:
sourceHandle: z.string().optional(),
targetHandle: z.string().optional(),

// After:
sourceHandle: z.string().nullable().optional(),
targetHandle: z.string().nullable().optional(),
```

This allows handles to be:
- `undefined` (not provided)
- `null` (explicitly null from React Flow)
- `string` (handle ID for logic nodes with multiple outputs)

## Files Changed

- ✅ `shared/src/schemas/workflow.ts` - Updated edge schema to allow null handles

## Verification

- ✅ Schema now accepts null values
- ✅ No linter errors
- ✅ Backward compatible (still accepts undefined and strings)
- ✅ Works with all node types (including logic nodes with multiple outputs)

## Status

✅ **FIXED** - Workflow execution now accepts edges with null handles.

---

**Last Updated:** 2024-11-10

