# RAG (Retrieval-Augmented Generation) Implementation Explanation

## Overview

RAG (Retrieval-Augmented Generation) is a technique that enhances LLM responses by retrieving relevant context from a knowledge base before generating an answer. This implementation provides a complete RAG pipeline with document ingestion, vector storage, semantic search, and answer generation.

---

## Architecture

The RAG implementation consists of **4 main components**:

1. **Document Ingestion** - Process and chunk documents
2. **Vector Store** - Store and manage embeddings
3. **Semantic Search** - Find relevant documents
4. **RAG Pipeline** - Complete end-to-end RAG workflow

---

## 1. Document Ingestion (`ai.document_ingest`)

### Purpose
Processes documents (text, PDF, DOCX) and splits them into smaller chunks for better retrieval.

### Implementation Location
`backend/src/services/nodeExecutors/rag.ts` - `executeDocumentIngest()`

### How It Works

```typescript
// Input: Raw text or file
// Output: Chunks with metadata

1. Accepts text or base64-encoded file
2. Applies chunking strategy:
   - Fixed-size: Split by character count with overlap
   - Sentence-based: Split by sentences, respecting chunk size
   - Paragraph-based: Split by paragraphs
3. Returns chunks with metadata (index, position, length)
```

### Chunking Strategies

**Fixed-Size Chunking**:
- Splits text into fixed-size chunks (default: 1000 chars)
- Uses overlap (default: 200 chars) to preserve context
- Example: "Hello world" → ["Hello wo", "o world"] (with overlap)

**Sentence-Based Chunking**:
- Splits by sentence boundaries (`.`, `!`, `?`)
- Respects maximum chunk size
- Preserves sentence integrity

**Paragraph-Based Chunking**:
- Splits by paragraph boundaries (double newlines)
- Each paragraph becomes a chunk
- Preserves document structure

### Code Example

```typescript
// Fixed-size chunking with overlap
let start = 0;
while (start < content.length) {
  const end = Math.min(start + chunkSize, content.length);
  const chunk = content.slice(start, end);
  chunks.push(chunk);
  start = end - chunkOverlap; // Overlap for context
}
```

---

## 2. Vector Store (`ai.vector_store`)

### Purpose
Stores document embeddings (vector representations) for fast similarity search.

### Implementation Location
- Executor: `backend/src/services/nodeExecutors/rag.ts` - `executeVectorStore()`
- Storage: `backend/src/services/vectorStore.ts`

### How It Works

```typescript
// Store Operation:
1. Accepts embeddings (number[][]) and texts (string[])
2. Creates documents with embeddings, text, and metadata
3. Stores in vector database (in-memory or external)
4. Returns document IDs

// Search Operation:
1. Accepts query embedding (number[])
2. Calculates cosine similarity with all stored vectors
3. Returns top-K most similar documents

// Delete Operation:
1. Accepts document IDs
2. Removes documents from vector store
```

### Vector Storage Providers

**In-Memory (Default)**:
- Stores vectors in a `Map<string, VectorDocument[]>`
- Fast for development/testing
- Data lost on server restart
- Uses cosine similarity for search

**External Providers** (Requires packages):
- **Pinecone**: Cloud vector database
- **Weaviate**: Open-source vector database
- **Chroma**: Embedded vector database

### Cosine Similarity Calculation

```typescript
cosineSimilarity(a, b) = (a · b) / (||a|| × ||b||)

Where:
- a · b = dot product
- ||a|| = magnitude of vector a
- Result: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)
```

### Code Example

```typescript
// Store vectors
const documents = embeddings.map((embedding, index) => ({
  embedding,
  text: texts[index],
  metadata: { source: 'document.pdf', page: index }
}));

const ids = await storeVectors('memory', 'my-index', documents);

// Search vectors
const results = await queryVectors('memory', 'my-index', queryEmbedding, 5);
// Returns: [{ id, text, score, metadata }, ...]
```

---

## 3. Semantic Search (`ai.semantic_search`)

### Purpose
Finds semantically similar documents to a query using vector similarity.

### Implementation Location
`backend/src/services/nodeExecutors/rag.ts` - `executeSemanticSearch()`

### How It Works

```typescript
1. Accepts query text or query embedding
2. If text provided, generates embedding using AI service
3. Searches vector store for similar documents
4. Filters results by minimum similarity score
5. Returns top-K most relevant documents
```

### Features

- **Automatic Embedding Generation**: Converts text to embedding if not provided
- **Score Filtering**: Only returns results above minimum score threshold
- **Top-K Results**: Configurable number of results (default: 5)
- **Metadata Preservation**: Returns original document metadata

### Code Example

```typescript
// Generate embedding from query text
const embedding = await aiService.generateEmbedding("What is RAG?");

// Search for similar documents
const results = await queryVectors('memory', 'my-index', embedding, 5);

// Filter by minimum score (0.7 = 70% similarity)
const filtered = results.filter(r => r.score >= 0.7);
```

---

## 4. RAG Pipeline (`ai.rag`)

### Purpose
Complete end-to-end RAG workflow: retrieve relevant context and generate answer.

### Implementation Location
`backend/src/services/nodeExecutors/rag.ts` - `executeRAG()`

### How It Works - Step by Step

#### Step 1: Generate Query Embedding
```typescript
const queryEmbedding = await aiService.generateEmbedding(query);
// Converts "What is RAG?" → [0.123, -0.456, 0.789, ...] (1536 dimensions for OpenAI)
```

#### Step 2: Search Vector Store
```typescript
const searchResults = await queryVectors(
  vectorStoreProvider, 
  indexName, 
  queryEmbedding, 
  topK
);
// Returns: [{ text: "...", score: 0.92, metadata: {...} }, ...]
```

#### Step 3: Build Context
```typescript
const context = searchResults
  .map((r, idx) => `[${idx + 1}] ${r.text}`)
  .join('\n\n');
// Combines top-K results into a single context string
```

#### Step 4: Build Prompt
```typescript
const prompt = promptTemplate
  .replace(/\{\{context\}\}/g, context)
  .replace(/\{\{query\}\}/g, query);

// Default template:
// "Use the following context to answer the question:
// 
// Context:
// [1] Document chunk 1...
// [2] Document chunk 2...
// 
// Question: What is RAG?
// 
// Answer:"
```

#### Step 5: Generate Answer
```typescript
const llmResponse = await aiService.generateText({
  prompt,
  config: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000
  }
});
// LLM generates answer using retrieved context
```

### Output

```typescript
{
  answer: "RAG is a technique that...",
  sources: [
    { text: "...", score: 0.92, metadata: {...} },
    { text: "...", score: 0.88, metadata: {...} }
  ],
  tokens: 150
}
```

---

## Complete RAG Workflow Example

### Workflow Steps

1. **Ingest Document**:
   ```
   Input: "RAG is a technique that combines retrieval and generation..."
   Output: Chunks: ["RAG is a technique...", "It works by...", ...]
   ```

2. **Generate Embeddings**:
   ```
   Input: Chunks
   Output: Embeddings: [[0.123, ...], [0.456, ...], ...]
   ```

3. **Store in Vector Database**:
   ```
   Input: Embeddings + Chunks
   Output: Document IDs: ["doc_1", "doc_2", ...]
   ```

4. **Query (RAG Pipeline)**:
   ```
   Input: "What is RAG?"
   Process:
     a. Generate query embedding
     b. Search for similar chunks
     c. Build context from top results
     d. Generate answer with context
   Output: "RAG is a technique that combines retrieval..."
   ```

---

## Embedding Generation

### Implementation
`backend/src/services/aiService.ts` - `generateEmbedding()`

### How It Works

```typescript
1. Accepts text input
2. Calls OpenAI Embeddings API (text-embedding-ada-002)
3. Returns 1536-dimensional vector
4. Vector represents semantic meaning of text
```

### Embedding Properties

- **Dimensions**: 1536 (OpenAI ada-002)
- **Semantic Meaning**: Similar texts have similar vectors
- **Distance**: Cosine similarity measures semantic similarity
- **Use Case**: Enables semantic search (not just keyword matching)

### Example

```typescript
"RAG is a technique" → [0.123, -0.456, 0.789, ...]
"Retrieval-Augmented Generation" → [0.125, -0.458, 0.791, ...]
// These are similar, so cosine similarity ≈ 0.95
```

---

## Vector Store Implementation Details

### In-Memory Vector Store

**Location**: `backend/src/services/vectorStore.ts`

**Data Structure**:
```typescript
Map<string, VectorDocument[]>
// Key: index name (e.g., "default", "documents")
// Value: Array of vector documents
```

**Vector Document**:
```typescript
{
  id: string,              // Unique document ID
  embedding: number[],     // 1536-dimensional vector
  text: string,            // Original text
  metadata?: {             // Optional metadata
    source?: string,
    page?: number,
    ...
  }
}
```

**Operations**:
- `upsert()`: Store or update documents
- `query()`: Search by cosine similarity
- `delete()`: Remove documents by ID

### Cosine Similarity Algorithm

```typescript
cosineSimilarity(a, b) = (a · b) / (||a|| × ||b||)

Steps:
1. Calculate dot product: Σ(a[i] × b[i])
2. Calculate magnitudes: √(Σ(a[i]²)) and √(Σ(b[i]²))
3. Divide: dotProduct / (magnitudeA × magnitudeB)
4. Result: -1 to 1 (higher = more similar)
```

---

## Node Types in Workflow Builder

### 1. Document Ingestion Node (`ai.document_ingest`)

**Config**:
- `fileType`: 'auto' | 'text' | 'pdf' | 'docx'
- `chunkSize`: Number (default: 1000)
- `chunkOverlap`: Number (default: 200)
- `chunkStrategy`: 'fixed' | 'sentence' | 'paragraph'

**Inputs**:
- `file`: Base64-encoded file or file path
- `text`: Raw text content

**Outputs**:
- `chunks`: Array of text chunks
- `metadata`: Chunk metadata

### 2. Vector Store Node (`ai.vector_store`)

**Config**:
- `provider`: 'memory' | 'pinecone' | 'weaviate' | 'chroma'
- `operation`: 'store' | 'search' | 'delete'
- `indexName`: String (default: 'default')
- `topK`: Number (default: 5)

**Inputs** (for store):
- `embeddings`: Array of embedding vectors
- `texts`: Array of text strings
- `metadata`: Optional metadata array

**Inputs** (for search):
- `embedding`: Query embedding vector

**Outputs**:
- `ids`: Document IDs (store operation)
- `results`: Search results (search operation)

### 3. Semantic Search Node (`ai.semantic_search`)

**Config**:
- `provider`: Vector store provider
- `indexName`: Index name
- `topK`: Number of results (default: 5)
- `minScore`: Minimum similarity score (default: 0.7)

**Inputs**:
- `query`: Query text (optional if embedding provided)
- `embedding`: Query embedding (optional if query provided)

**Outputs**:
- `results`: Array of search results with scores
- `count`: Number of results
- `query`: Original query

### 4. RAG Pipeline Node (`ai.rag`)

**Config**:
- `vectorStoreProvider`: Vector store provider
- `indexName`: Index name
- `llmProvider`: 'openai' | 'anthropic' | 'google'
- `model`: Model name (default: 'gpt-3.5-turbo')
- `topK`: Number of documents to retrieve (default: 5)
- `promptTemplate`: Custom prompt template

**Inputs**:
- `query`: Question to answer

**Outputs**:
- `answer`: Generated answer
- `sources`: Array of source documents with scores
- `tokens`: Tokens used

---

## Typical RAG Workflow

### Setup Phase (One-time)

```
1. Document Ingestion Node
   Input: Large document
   Output: Chunks

2. Embedding Node (or automatic in vector store)
   Input: Chunks
   Output: Embeddings

3. Vector Store Node (store operation)
   Input: Embeddings + Chunks
   Output: Document IDs
```

### Query Phase (Per Question)

```
1. RAG Pipeline Node
   Input: "What is RAG?"
   Process:
     - Generate query embedding
     - Search vector store
     - Build context
     - Generate answer
   Output: Answer with sources
```

---

## Key Features

### ✅ Implemented

1. **Multiple Chunking Strategies**: Fixed, sentence-based, paragraph-based
2. **In-Memory Vector Store**: Fast development/testing
3. **Cosine Similarity Search**: Semantic similarity matching
4. **Automatic Embedding Generation**: Converts text to embeddings
5. **Configurable Prompt Templates**: Customizable RAG prompts
6. **Multiple LLM Providers**: OpenAI, Anthropic, Google
7. **Score Filtering**: Minimum similarity threshold
8. **Metadata Support**: Store additional document information

### 🔄 Extensible

1. **External Vector Stores**: Pinecone, Weaviate, Chroma (requires packages)
2. **File Format Support**: PDF, DOCX (requires additional packages)
3. **Advanced Chunking**: Semantic chunking, recursive chunking
4. **Hybrid Search**: Combine semantic + keyword search
5. **Re-ranking**: Re-rank results for better accuracy

---

## Code Flow Diagram

```
User Query: "What is RAG?"
    ↓
[1] Generate Query Embedding
    aiService.generateEmbedding("What is RAG?")
    → [0.123, -0.456, 0.789, ...]
    ↓
[2] Search Vector Store
    queryVectors(provider, index, embedding, topK=5)
    → Calculate cosine similarity with all stored vectors
    → Sort by score, return top 5
    ↓
[3] Build Context
    Combine top results: "[1] Document 1...\n[2] Document 2..."
    ↓
[4] Build Prompt
    Template: "Context: {{context}}\nQuestion: {{query}}\nAnswer:"
    → Replace placeholders
    ↓
[5] Generate Answer
    aiService.generateText(prompt)
    → LLM generates answer using context
    ↓
Output: Answer + Sources
```

---

## Example Usage in Workflow

### Workflow 1: Document Setup

```
[Document Ingestion] → [Embedding Generation] → [Vector Store (store)]
```

### Workflow 2: Query Answering

```
[User Input] → [RAG Pipeline] → [Answer Output]
```

### Workflow 3: Complete RAG System

```
[Document] → [Ingest] → [Embed] → [Store]
                                    ↓
[Query] → [RAG Pipeline] ← [Vector Store]
              ↓
         [Answer]
```

---

## Performance Considerations

### In-Memory Store
- **Pros**: Fast, no external dependencies
- **Cons**: Data lost on restart, limited by RAM
- **Use Case**: Development, testing, small datasets

### External Stores (Pinecone, Weaviate, Chroma)
- **Pros**: Persistent, scalable, optimized for similarity search
- **Cons**: Requires setup, API keys, network latency
- **Use Case**: Production, large datasets

### Optimization Tips

1. **Chunk Size**: Balance between context and precision
   - Too small: Loses context
   - Too large: Less precise retrieval

2. **Top-K**: Retrieve more documents for better context
   - Default: 5
   - Increase for complex queries

3. **Min Score**: Filter low-quality results
   - Default: 0.7
   - Adjust based on use case

---

## Integration Points

### With Other Nodes

1. **Embedding Node**: Can generate embeddings separately
2. **LLM Node**: Can use retrieved context in custom prompts
3. **Code Node**: Can process search results programmatically
4. **HTTP Node**: Can fetch documents from external sources

### With Workflow System

- **Parallel Execution**: Can ingest multiple documents in parallel
- **Conditional Logic**: Can branch based on search results
- **Error Handling**: Can retry failed operations
- **Debugging**: Can inspect embeddings and search results

---

## Summary

The RAG implementation provides:

1. ✅ **Complete Pipeline**: Document → Chunks → Embeddings → Storage → Retrieval → Answer
2. ✅ **Flexible Configuration**: Multiple strategies, providers, and options
3. ✅ **Semantic Search**: Cosine similarity for meaning-based retrieval
4. ✅ **LLM Integration**: Seamless integration with OpenAI, Anthropic, Google
5. ✅ **Workflow Integration**: Works as nodes in the visual workflow builder

**Key Innovation**: Combines the power of vector similarity search with LLM generation to provide accurate, context-aware answers from your own knowledge base.

---

**Files**:
- `backend/src/services/nodeExecutors/rag.ts` - RAG node executors
- `backend/src/services/vectorStore.ts` - Vector storage implementation
- `backend/src/services/aiService.ts` - Embedding and LLM generation
- `frontend/src/lib/nodes/nodeRegistry.ts` - Node definitions

