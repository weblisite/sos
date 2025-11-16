# OCR Implementation Breakdown for SynthralOS

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [Component Structure](#component-structure)
4. [Implementation Details](#implementation-details)
5. [Integration Points](#integration-points)
6. [Example Workflows](#example-workflows)
7. [Technical Specifications](#technical-specifications)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Workflow Builder UI                                      │  │
│  │  - Node Palette (OCR node)                                │  │
│  │  - Node Configuration Panel                               │  │
│  │  - Workflow Canvas                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Workflow Executor                                        │  │
│  │  - Routes to Node Executors                               │  │
│  │  - Manages execution context                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OCR Node Executor (ocr.ts)                              │  │
│  │  - Validates inputs                                       │  │
│  │  - Calls OCR Service                                      │  │
│  │  - Formats output                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OCR Service (ocrService.ts)                             │  │
│  │  - Provider abstraction layer                             │  │
│  │  - Image preprocessing                                    │  │
│  │  - Multi-page PDF handling                                │  │
│  │  - Table/form extraction                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Tesseract.js    │  │  Google Vision   │
        │  (Self-hosted)   │  │  API (Cloud)     │
        └──────────────────┘  └──────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌──────────────────┐
                    │  OCR Results     │
                    │  - Text          │
                    │  - Metadata      │
                    │  - Confidence    │
                    └──────────────────┘
```

---

## Data Flow

### 1. Workflow Execution Flow

```
User Creates Workflow
    │
    ├─> Adds OCR Node to Canvas
    │   └─> Configures: Provider, Language, Options
    │
    ├─> Connects Input Node (e.g., Email Trigger)
    │   └─> Input: email.attachments[0].data (base64 image)
    │
    ├─> Connects Output Node (e.g., LLM Node)
    │   └─> Output: ocr.text (extracted text)
    │
    └─> Saves & Activates Workflow
```

### 2. Runtime Execution Flow

```
Email Trigger Fires
    │
    ├─> Email received with PDF attachment
    │   └─> Attachment converted to base64
    │
    ├─> Workflow Executor receives trigger
    │   └─> Input: { email: { attachments: [...] } }
    │
    ├─> OCR Node Executor called
    │   ├─> Extracts: input.email.attachments[0].data
    │   ├─> Validates: Is it image/PDF? Is base64 valid?
    │   └─> Calls OCR Service
    │
    ├─> OCR Service processes
    │   ├─> Detects file type (image/PDF)
    │   ├─> Preprocesses image (if needed)
    │   ├─> Routes to provider (Tesseract/Google/AWS)
    │   ├─> Processes file
    │   │   ├─> If PDF: Extract pages → OCR each page
    │   │   └─> If Image: Direct OCR
    │   └─> Returns structured result
    │
    ├─> OCR Node Executor formats output
    │   └─> Output: {
    │         text: "Extracted text...",
    │         structuredData: { tables: [...], forms: [...] },
    │         confidence: 0.95,
    │         metadata: { pages: 3, language: "eng" }
    │       }
    │
    └─> Next Node receives output
        └─> LLM Node analyzes extracted text
```

### 3. Input Processing Flow

```
Input Received (Multiple Formats Supported)
    │
    ├─> Format 1: Base64 Image
    │   └─> data:image/png;base64,iVBORw0KGgo...
    │       ├─> Extract base64 string
    │       ├─> Convert to Buffer
    │       └─> Process as image
    │
    ├─> Format 2: Image URL
    │   └─> https://example.com/image.png
    │       ├─> Fetch image via HTTP
    │       ├─> Convert to Buffer
    │       └─> Process as image
    │
    ├─> Format 3: Base64 PDF
    │   └─> data:application/pdf;base64,JVBERi0...
    │       ├─> Extract base64 string
    │       ├─> Convert to Buffer
    │       ├─> Extract pages (using pdf-parse)
    │       └─> OCR each page → Combine results
    │
    ├─> Format 4: PDF URL
    │   └─> https://example.com/document.pdf
    │       ├─> Fetch PDF via HTTP
    │       ├─> Convert to Buffer
    │       ├─> Extract pages
    │       └─> OCR each page → Combine results
    │
    └─> Format 5: File Path (from File Node)
        └─> /uploads/document.pdf
            ├─> Read file from filesystem
            ├─> Convert to Buffer
            └─> Process based on file type
```

---

## Component Structure

### 1. Frontend Components

#### A. Node Registry Entry (`frontend/src/lib/nodes/nodeRegistry.ts`)

```typescript
'ai.ocr': {
  type: 'ai.ocr',
  name: 'Extract Text (OCR)',
  description: 'Extract text from images, PDFs, or scanned documents',
  category: 'ai',
  icon: 'scan',
  inputs: [
    { 
      name: 'imageUrl', 
      type: 'string', 
      description: 'Image URL to process',
      required: false 
    },
    { 
      name: 'imageBase64', 
      type: 'string', 
      description: 'Image as base64 data URI',
      required: false 
    },
    { 
      name: 'pdfUrl', 
      type: 'string', 
      description: 'PDF URL to process',
      required: false 
    },
    { 
      name: 'pdfBase64', 
      type: 'string', 
      description: 'PDF as base64 data URI',
      required: false 
    },
    { 
      name: 'file', 
      type: 'string', 
      description: 'File path or base64 content (auto-detect type)',
      required: false 
    },
  ],
  outputs: [
    { 
      name: 'text', 
      type: 'string', 
      description: 'Extracted plain text' 
    },
    { 
      name: 'structuredData', 
      type: 'object', 
      description: 'Structured data (tables, forms, key-value pairs)' 
    },
    { 
      name: 'confidence', 
      type: 'number', 
      description: 'Overall confidence score (0-1)' 
    },
    { 
      name: 'metadata', 
      type: 'object', 
      description: 'OCR metadata (language, pages, processing time)' 
    },
    { 
      name: 'pages', 
      type: 'array', 
      description: 'Array of page results (for multi-page documents)' 
    },
  ],
  config: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['tesseract', 'google', 'aws', 'azure', 'openai'],
        default: 'tesseract',
        description: 'OCR provider to use'
      },
      language: {
        type: 'string',
        description: 'Language code (e.g., eng, spa, fra, deu)',
        default: 'eng',
      },
      extractTables: {
        type: 'boolean',
        description: 'Extract tables as structured data',
        default: false,
      },
      extractForms: {
        type: 'boolean',
        description: 'Extract form fields as key-value pairs',
        default: false,
      },
      preprocess: {
        type: 'boolean',
        description: 'Apply image preprocessing (deskew, denoise)',
        default: true,
      },
      apiKey: {
        type: 'string',
        description: 'API key for cloud providers (optional, can use env var)',
        default: '',
      },
    },
    required: ['provider'],
  },
}
```

#### B. Node Configuration UI (`frontend/src/components/NodeConfigPanel.tsx`)

The existing `NodeConfigPanel` component will automatically render the OCR node configuration based on the schema above. It will show:
- Provider dropdown (Tesseract, Google, AWS, Azure, OpenAI)
- Language input field
- Checkboxes for table/form extraction
- Preprocessing toggle
- API key input (for cloud providers)

### 2. Backend Components

#### A. OCR Service (`backend/src/services/ocrService.ts`)

**Purpose**: Core OCR processing logic with provider abstraction

**Key Functions**:

```typescript
class OCRService {
  // Main processing function
  async process(input: OCRInput, config: OCRConfig): Promise<OCRResult>
  
  // Provider-specific implementations
  private async processWithTesseract(buffer: Buffer, config: OCRConfig): Promise<OCRResult>
  private async processWithGoogle(buffer: Buffer, config: OCRConfig): Promise<OCRResult>
  private async processWithAWS(buffer: Buffer, config: OCRConfig): Promise<OCRResult>
  private async processWithAzure(buffer: Buffer, config: OCRConfig): Promise<OCRResult>
  private async processWithOpenAI(buffer: Buffer, config: OCRConfig): Promise<OCRResult>
  
  // Helper functions
  private async preprocessImage(buffer: Buffer): Promise<Buffer>
  private async extractPDFPages(buffer: Buffer): Promise<Buffer[]>
  private detectLanguage(buffer: Buffer): Promise<string>
  private extractTables(result: any): Promise<Table[]>
  private extractForms(result: any): Promise<FormField[]>
}
```

**Input Types**:
```typescript
interface OCRInput {
  imageUrl?: string;
  imageBase64?: string;
  pdfUrl?: string;
  pdfBase64?: string;
  file?: string; // File path or base64
}

interface OCRConfig {
  provider: 'tesseract' | 'google' | 'aws' | 'azure' | 'openai';
  language?: string;
  extractTables?: boolean;
  extractForms?: boolean;
  preprocess?: boolean;
  apiKey?: string;
}
```

**Output Types**:
```typescript
interface OCRResult {
  text: string; // Combined text from all pages
  structuredData?: {
    tables?: Table[];
    forms?: FormField[];
  };
  confidence: number; // Average confidence (0-1)
  metadata: {
    language: string;
    pages: number;
    processingTime: number;
    provider: string;
  };
  pages?: PageResult[]; // Individual page results
}

interface PageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  boundingBoxes?: BoundingBox[];
}

interface Table {
  rows: string[][];
  headers?: string[];
  confidence: number;
}

interface FormField {
  key: string;
  value: string;
  confidence: number;
}
```

#### B. OCR Node Executor (`backend/src/services/nodeExecutors/ocr.ts`)

**Purpose**: Bridge between workflow system and OCR service

**Implementation**:

```typescript
export async function executeOCR(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, workflowId } = context;
  const nodeConfig = config as any;

  // Extract configuration
  const provider = (nodeConfig.provider as string) || 'tesseract';
  const language = (nodeConfig.language as string) || 'eng';
  const extractTables = (nodeConfig.extractTables as boolean) || false;
  const extractForms = (nodeConfig.extractForms as boolean) || false;
  const preprocess = (nodeConfig.preprocess as boolean) !== false;
  const apiKey = (nodeConfig.apiKey as string) || undefined;

  // Extract input (supports multiple formats)
  const imageUrl = (input.imageUrl as string) || '';
  const imageBase64 = (input.imageBase64 as string) || '';
  const pdfUrl = (input.pdfUrl as string) || '';
  const pdfBase64 = (input.pdfBase64 as string) || '';
  const file = (input.file as string) || '';

  // Validate input
  if (!imageUrl && !imageBase64 && !pdfUrl && !pdfBase64 && !file) {
    return {
      success: false,
      error: {
        message: 'At least one input is required: imageUrl, imageBase64, pdfUrl, pdfBase64, or file',
        code: 'MISSING_INPUT',
      },
    };
  }

  try {
    // Prepare OCR input
    const ocrInput: OCRInput = {
      imageUrl: imageUrl || undefined,
      imageBase64: imageBase64 || undefined,
      pdfUrl: pdfUrl || undefined,
      pdfBase64: pdfBase64 || undefined,
      file: file || undefined,
    };

    // Prepare OCR config
    const ocrConfig: OCRConfig = {
      provider: provider as any,
      language,
      extractTables,
      extractForms,
      preprocess,
      apiKey,
    };

    // Process with OCR service
    const ocrService = new OCRService();
    const result = await ocrService.process(ocrInput, ocrConfig);

    // Return formatted output
    return {
      success: true,
      output: {
        text: result.text,
        structuredData: result.structuredData,
        confidence: result.confidence,
        metadata: result.metadata,
        pages: result.pages,
      },
      metadata: {
        executionTime: result.metadata.processingTime,
        provider: result.metadata.provider,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'OCR processing failed',
        code: 'OCR_ERROR',
        details: error,
      },
    };
  }
}
```

#### C. Node Executor Registration (`backend/src/services/nodeExecutors/index.ts`)

Add OCR executor to the routing:

```typescript
// ... existing imports ...
import { executeOCR } from './ocr';

export async function executeNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  // ... existing code ...
  
  } else if (nodeType === 'ai.ocr') {
    result = await executeOCR(context);
  } else {
    // ... existing code ...
  }
}
```

---

## Implementation Details

### 1. Provider Implementations

#### A. Tesseract.js (Self-hosted)

**Setup**:
```bash
npm install tesseract.js
```

**Implementation**:
```typescript
import { createWorker } from 'tesseract.js';

private async processWithTesseract(
  buffer: Buffer, 
  config: OCRConfig
): Promise<OCRResult> {
  const worker = await createWorker(config.language || 'eng');
  
  // Preprocess if enabled
  let imageBuffer = buffer;
  if (config.preprocess) {
    imageBuffer = await this.preprocessImage(buffer);
  }
  
  // Perform OCR
  const { data } = await worker.recognize(imageBuffer);
  
  await worker.terminate();
  
  return {
    text: data.text,
    confidence: data.confidence / 100, // Convert to 0-1 scale
    metadata: {
      language: config.language || 'eng',
      pages: 1,
      processingTime: data.words?.length || 0,
      provider: 'tesseract',
    },
  };
}
```

**Pros**:
- Free, no API costs
- Self-hosted, no external dependencies
- Good for basic OCR needs

**Cons**:
- Lower accuracy than cloud providers
- Slower processing
- Limited table/form extraction

#### B. Google Cloud Vision API

**Setup**:
```bash
npm install @google-cloud/vision
```

**Implementation**:
```typescript
import { ImageAnnotatorClient } from '@google-cloud/vision';

private async processWithGoogle(
  buffer: Buffer,
  config: OCRConfig
): Promise<OCRResult> {
  const client = new ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // Or use API key
    apiKey: config.apiKey || process.env.GOOGLE_VISION_API_KEY,
  });
  
  const [result] = await client.textDetection({
    image: { content: buffer },
  });
  
  const detections = result.textAnnotations || [];
  const fullText = detections[0]?.description || '';
  
  // Calculate average confidence
  const confidences = detections
    .slice(1)
    .map(d => d.confidence || 0)
    .filter(c => c > 0);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.9;
  
  return {
    text: fullText,
    confidence: avgConfidence,
    metadata: {
      language: result.textAnnotations?.[0]?.locale || 'en',
      pages: 1,
      processingTime: Date.now(),
      provider: 'google',
    },
  };
}
```

**Pros**:
- High accuracy
- Multi-language support
- Good for production use

**Cons**:
- Requires API key
- Costs per request
- External dependency

#### C. AWS Textract

**Setup**:
```bash
npm install @aws-sdk/client-textract
```

**Implementation**:
```typescript
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

private async processWithAWS(
  buffer: Buffer,
  config: OCRConfig
): Promise<OCRResult> {
  const client = new TextractClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: config.apiKey || process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
  
  // Use AnalyzeDocument for tables/forms, DetectDocumentText for simple text
  const command = config.extractTables || config.extractForms
    ? new AnalyzeDocumentCommand({
        Document: { Bytes: buffer },
        FeatureTypes: [
          ...(config.extractTables ? ['TABLES'] : []),
          ...(config.extractForms ? ['FORMS'] : []),
        ],
      })
    : new DetectDocumentTextCommand({
        Document: { Bytes: buffer },
      });
  
  const response = await client.send(command);
  
  // Extract text from blocks
  const textBlocks = response.Blocks?.filter(b => b.BlockType === 'LINE') || [];
  const text = textBlocks.map(b => b.Text || '').join('\n');
  
  // Extract tables if requested
  let tables: Table[] = [];
  if (config.extractTables && response.Blocks) {
    tables = this.extractTablesFromAWS(response.Blocks);
  }
  
  // Extract forms if requested
  let forms: FormField[] = [];
  if (config.extractForms && response.Blocks) {
    forms = this.extractFormsFromAWS(response.Blocks);
  }
  
  return {
    text,
    structuredData: {
      ...(tables.length > 0 && { tables }),
      ...(forms.length > 0 && { forms }),
    },
    confidence: 0.95, // AWS doesn't provide per-line confidence
    metadata: {
      language: 'en', // AWS auto-detects
      pages: 1,
      processingTime: Date.now(),
      provider: 'aws',
    },
  };
}
```

**Pros**:
- Excellent table/form extraction
- High accuracy
- Good for structured documents

**Cons**:
- More expensive
- Requires AWS account
- Complex setup

### 2. PDF Processing

**Multi-page PDF handling**:

```typescript
import pdfParse from 'pdf-parse';
import sharp from 'sharp'; // For converting PDF pages to images

private async extractPDFPages(buffer: Buffer): Promise<Buffer[]> {
  // For scanned PDFs, we need to convert pages to images
  // For text-based PDFs, we can extract text directly
  
  try {
    // Try to extract text directly first
    const pdfData = await pdfParse(buffer);
    if (pdfData.text.trim().length > 100) {
      // Text-based PDF - return as single page
      return [Buffer.from(pdfData.text)];
    }
  } catch (error) {
    // Scanned PDF - need to convert to images
  }
  
  // For scanned PDFs, use pdf2pic or similar to convert pages to images
  // Then OCR each image
  // This requires additional setup (pdf2pic, imagemagick)
  
  // Simplified: For now, return buffer for single-page processing
  // Full implementation would convert each page to image
  return [buffer];
}
```

### 3. Image Preprocessing

**Enhance OCR accuracy**:

```typescript
import sharp from 'sharp';
import Jimp from 'jimp'; // Alternative image processing

private async preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    // Use sharp for image preprocessing
    const processed = await sharp(buffer)
      .greyscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Sharpen edges
      .toBuffer();
    
    return processed;
  } catch (error) {
    // If preprocessing fails, return original
    console.warn('Image preprocessing failed:', error);
    return buffer;
  }
}
```

---

## Integration Points

### 1. Email Trigger Integration

**Auto-OCR email attachments**:

```typescript
// In emailTriggerService.ts
// After receiving email with attachment:

if (message.attachments && message.attachments.length > 0) {
  for (const attachment of message.attachments) {
    // Check if attachment is image or PDF
    const isImage = attachment.contentType?.startsWith('image/');
    const isPDF = attachment.contentType === 'application/pdf';
    
    if (isImage || isPDF) {
      // Add OCR result to email data
      if (attachment.data) {
        try {
          const ocrService = new OCRService();
          const ocrResult = await ocrService.process(
            { 
              [isPDF ? 'pdfBase64' : 'imageBase64']: attachment.data 
            },
            { provider: 'tesseract', language: 'eng' }
          );
          
          attachment.ocrText = ocrResult.text;
          attachment.ocrConfidence = ocrResult.confidence;
        } catch (error) {
          console.error('OCR failed for attachment:', error);
        }
      }
    }
  }
}
```

### 2. Document Ingestion Integration

**Enhance document ingestion with OCR**:

```typescript
// In rag.ts, enhance parseFileContent function:

async function parseFileContent(file: string, fileType: string): Promise<string> {
  // ... existing code ...
  
  if (actualFileType === 'pdf') {
    try {
      // Try text extraction first
      const pdfData = await pdfParse(buffer);
      if (pdfData.text.trim().length > 100) {
        return pdfData.text; // Text-based PDF
      }
    } catch (error) {
      // Fall through to OCR
    }
    
    // Scanned PDF - use OCR
    const ocrService = new OCRService();
    const ocrResult = await ocrService.process(
      { pdfBase64: file },
      { provider: 'tesseract', language: 'eng' }
    );
    return ocrResult.text;
  }
  
  // ... rest of existing code ...
}
```

### 3. File Node Integration

**OCR support in file operations**:

```typescript
// In file.ts, add OCR option:

if (operation === 'read' && nodeConfig.ocr) {
  // Read file and run OCR
  const fileBuffer = await fs.readFile(path);
  const ocrService = new OCRService();
  const ocrResult = await ocrService.process(
    { file: fileBuffer.toString('base64') },
    nodeConfig.ocrConfig || {}
  );
  return {
    success: true,
    output: {
      content: ocrResult.text,
      ocrMetadata: ocrResult.metadata,
    },
  };
}
```

---

## Example Workflows

### Workflow 1: Invoice Processing

```
┌─────────────────┐
│ Email Trigger   │
│ (Gmail)         │
└────────┬────────┘
         │
         │ email.attachments[0].data
         ▼
┌─────────────────┐
│ OCR Node        │
│ Provider: Google│
│ Extract Tables  │
└────────┬────────┘
         │
         │ ocr.text, ocr.structuredData
         ▼
┌─────────────────┐
│ Transform Node  │
│ Parse invoice   │
│ fields          │
└────────┬────────┘
         │
         │ { invoiceNumber, amount, date, vendor }
         ▼
┌─────────────────┐
│ Database Node   │
│ Store in DB     │
└─────────────────┘
```

**Node Configuration**:
- **OCR Node**: 
  - Provider: `google`
  - Extract Tables: `true`
  - Language: `eng`
- **Transform Node**: 
  - Extract: `invoiceNumber`, `amount`, `date`, `vendor` from structured data
- **Database Node**: 
  - Table: `invoices`
  - Insert extracted fields

### Workflow 2: Receipt Digitization

```
┌─────────────────┐
│ Schedule Trigger│
│ (Daily 9 AM)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ File Node       │
│ Read: /receipts │
└────────┬────────┘
         │
         │ files[]
         ▼
┌─────────────────┐
│ Loop Node       │
│ (For each file) │
└────────┬────────┘
         │
         │ file.data
         ▼
┌─────────────────┐
│ OCR Node        │
│ Provider: AWS   │
│ Extract Forms   │
└────────┬────────┘
         │
         │ ocr.text, ocr.structuredData.forms
         ▼
┌─────────────────┐
│ LLM Node        │
│ Extract:        │
│ - Merchant      │
│ - Amount        │
│ - Date          │
│ - Category      │
└────────┬────────┘
         │
         │ { merchant, amount, date, category }
         ▼
┌─────────────────┐
│ CSV Node        │
│ Export to       │
│ expenses.csv    │
└─────────────────┘
```

### Workflow 3: Document Search Enhancement

```
┌─────────────────┐
│ Webhook Trigger │
│ (Document upload)│
└────────┬────────┘
         │
         │ body.file (base64 PDF)
         ▼
┌─────────────────┐
│ OCR Node        │
│ Provider: Tesseract│
│ Full text       │
└────────┬────────┘
         │
         │ ocr.text
         ▼
┌─────────────────┐
│ Document        │
│ Ingestion Node  │
│ Chunk text      │
└────────┬────────┘
         │
         │ chunks[]
         ▼
┌─────────────────┐
│ Embedding Node  │
│ Create vectors  │
└────────┬────────┘
         │
         │ embeddings[]
         ▼
┌─────────────────┐
│ Vector Store    │
│ Store for RAG   │
└─────────────────┘
```

### Workflow 4: Form Processing

```
┌─────────────────┐
│ Manual Trigger  │
│ (Upload form)   │
└────────┬────────┘
         │
         │ input.file
         ▼
┌─────────────────┐
│ OCR Node        │
│ Provider: AWS   │
│ Extract Forms   │
│ Extract Tables  │
└────────┬────────┘
         │
         │ ocr.structuredData
         ▼
┌─────────────────┐
│ Transform Node  │
│ Map to schema   │
└────────┬────────┘
         │
         │ structuredData
         ▼
┌─────────────────┐
│ If Node         │
│ Validate data   │
└────┬────────┬───┘
     │        │
     │ Valid  │ Invalid
     ▼        ▼
┌─────────┐ ┌─────────┐
│ Airtable│ │ Email   │
│ Update  │ │ Alert   │
└─────────┘ └─────────┘
```

---

## Technical Specifications

### 1. File Format Support

| Format | Support | Notes |
|--------|---------|-------|
| PNG | ✅ Full | Direct OCR |
| JPEG/JPG | ✅ Full | Direct OCR |
| PDF (Text-based) | ✅ Full | Extract text directly |
| PDF (Scanned) | ✅ Full | Convert pages to images, then OCR |
| TIFF | ✅ Full | Direct OCR |
| WebP | ✅ Full | Convert to PNG first |
| GIF | ⚠️ Limited | First frame only |
| DOCX | ❌ Not OCR | Use existing document ingestion |
| XLSX | ❌ Not OCR | Use CSV node |

### 2. Language Support

| Provider | Languages | Notes |
|----------|-----------|-------|
| Tesseract | 100+ | Requires language pack installation |
| Google Vision | 50+ | Auto-detection available |
| AWS Textract | 10+ | Primarily English, Spanish, French, etc. |
| Azure | 25+ | Good European language support |
| OpenAI Vision | Limited | Best for English, can handle others |

### 3. Performance Characteristics

| Provider | Speed | Accuracy | Cost |
|----------|-------|----------|------|
| Tesseract | Medium | Good (85-90%) | Free |
| Google Vision | Fast | Excellent (95%+) | $1.50/1000 pages |
| AWS Textract | Medium | Excellent (95%+) | $1.50/1000 pages |
| Azure | Fast | Excellent (95%+) | $1.00/1000 pages |
| OpenAI Vision | Fast | Good (90%+) | $0.01/image |

### 4. API Rate Limits

| Provider | Rate Limit | Notes |
|----------|------------|-------|
| Tesseract | None | Limited by server resources |
| Google Vision | 1800 req/min | Can request increase |
| AWS Textract | 50 req/sec | Soft limit, can increase |
| Azure | 10 req/sec | Per region |
| OpenAI Vision | 500 req/min | Per API key |

### 5. Error Handling

**Common Errors**:
- `MISSING_INPUT`: No input provided
- `INVALID_FORMAT`: Unsupported file format
- `API_KEY_MISSING`: Cloud provider requires API key
- `PROCESSING_FAILED`: OCR processing error
- `FILE_TOO_LARGE`: File exceeds size limit
- `LANGUAGE_NOT_SUPPORTED`: Requested language not available

**Error Recovery**:
- Automatic fallback to Tesseract if cloud provider fails
- Retry logic with exponential backoff
- Detailed error messages for debugging

---

## Implementation Checklist

### Phase 1: Basic OCR Node
- [ ] Create `ocrService.ts` with Tesseract.js implementation
- [ ] Create `ocr.ts` node executor
- [ ] Register node in `nodeExecutors/index.ts`
- [ ] Add node definition to `nodeRegistry.ts`
- [ ] Test with simple images

### Phase 2: Multi-format Support
- [ ] Add PDF support (text-based and scanned)
- [ ] Add URL fetching support
- [ ] Add image preprocessing
- [ ] Test with various file formats

### Phase 3: Cloud Provider Integration
- [ ] Add Google Vision API support
- [ ] Add AWS Textract support
- [ ] Add provider selection in UI
- [ ] Test with cloud providers

### Phase 4: Advanced Features
- [ ] Add table extraction
- [ ] Add form extraction
- [ ] Add multi-page PDF support
- [ ] Add language detection

### Phase 5: Integration Enhancements
- [ ] Auto-OCR for email attachments
- [ ] OCR in document ingestion
- [ ] OCR option in file node
- [ ] Performance optimization

---

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",
    "@google-cloud/vision": "^3.0.0",
    "@aws-sdk/client-textract": "^3.0.0",
    "@azure/cognitiveservices-computervision": "^8.0.0",
    "pdf-parse": "^1.1.1",
    "sharp": "^0.32.0",
    "axios": "^1.6.0"
  }
}
```

### Environment Variables

```env
# Tesseract (no config needed, but can set data path)
TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

# Google Vision API
GOOGLE_VISION_API_KEY=your_api_key_here
# OR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# AWS Textract
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Azure Computer Vision
AZURE_COMPUTER_VISION_KEY=your_key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/

# OpenAI (already configured)
OPENAI_API_KEY=your_key
```

---

This breakdown provides a complete technical overview of how OCR would work in your SynthralOS platform. The implementation follows your existing patterns and integrates seamlessly with your workflow system.

