# Custom Code & Code Agents - Phase 4 Complete

**Date:** 2024-12-19  
**Status:** ✅ Phase 4 ETL Hooks Complete

## Completed Tasks

### ✅ Phase 4.1: ETL Hooks in RAG Pipeline
- [x] Created `etlHookService.ts` for hook execution
- [x] Implemented `executePreIngestHook` function
- [x] Implemented `executePostAnswerHook` function
- [x] Integrated pre-ingest hook into `executeDocumentIngest`
- [x] Integrated post-answer hook into `executeRAG`
- [x] Added hook configuration to RAG node registry
- [x] Added hook configuration to Document Ingestion node registry
- [x] Added hook selector UI in NodeConfigPanel

## What's Working

1. **Pre-Ingest Hooks**
   - Execute before document chunking
   - Transform document content
   - Clean, normalize, or enrich documents
   - Input: `{ document, fileType, metadata }`
   - Output: Processed document string

2. **Post-Answer Hooks**
   - Execute after LLM generates answer
   - Enhance, format, or validate answers
   - Input: `{ answer, context, sources, query }`
   - Output: Enhanced answer string

3. **Hook Execution**
   - Uses code agents from registry
   - Increments usage count
   - OpenTelemetry tracing
   - Graceful error handling (falls back to original if hook fails)

4. **UI Integration**
   - Hook selector dropdown in NodeConfigPanel
   - Shows agent name, language, and version
   - Available for RAG and Document Ingestion nodes

## Use Cases

### Pre-Ingest Hook Examples
- **Document Cleanup**: Remove headers, footers, watermarks
- **Metadata Enrichment**: Add compliance tags, categories
- **Content Normalization**: Standardize formatting, dates, currencies
- **Chunk Optimization**: Pre-process for better chunking

### Post-Answer Hook Examples
- **Answer Formatting**: Convert to markdown, add citations
- **Compliance Tagging**: Add regulatory tags to answers
- **Answer Validation**: Check for accuracy, completeness
- **Response Enhancement**: Add context, links, references

## Code Agent Hook Format

### Pre-Ingest Hook
```javascript
// Input: { document, fileType, metadata }
// Output: processed document string or { document: "...", processedDocument: "..." }

// Example: Clean and normalize document
const cleaned = document
  .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
  .trim();

// Add metadata tag
const enriched = `[COMPLIANCE: GDPR]\n${cleaned}`;

return enriched; // or { document: enriched }
```

### Post-Answer Hook
```javascript
// Input: { answer, context, sources, query }
// Output: enhanced answer string or { answer: "...", enhancedAnswer: "..." }

// Example: Add citations to answer
const citations = sources.map((s, i) => `[${i + 1}]`).join(' ');
const enhanced = `${answer}\n\nSources: ${citations}`;

return enhanced; // or { answer: enhanced }
```

## Integration Points

### Document Ingestion Node
- Config field: `preIngestHook` (code agent ID)
- Executes before chunking
- Transforms raw document content

### RAG Pipeline Node
- Config field: `postAnswerHook` (code agent ID)
- Executes after LLM answer generation
- Enhances final answer

## Next Steps

### Phase 4 Enhancements (Optional)
- [ ] Streaming transforms for large files (>100MB)
- [ ] Bacalhau integration for distributed processing
- [ ] Hook execution metrics dashboard
- [ ] Hook testing interface in Sandbox Studio

### Phase 6: Observability
- [ ] Enhanced OpenTelemetry spans for hooks
- [ ] Hook execution metrics
- [ ] PostHog event tracking for hook usage

## Notes

- Hooks are optional - if not configured, pipeline runs normally
- Hook failures are non-blocking - original content/answer is used if hook fails
- Hooks can be any code agent from the registry
- Hook execution is traced with OpenTelemetry
- Usage counts are incremented for analytics

