# OCR Quick Reference Guide

## Quick Start

### 1. Basic OCR Node Usage

**In Workflow Builder**:
1. Drag "Extract Text (OCR)" node to canvas
2. Connect input (e.g., from Email Trigger attachment)
3. Configure:
   - Provider: `tesseract` (free) or `google` (paid, better accuracy)
   - Language: `eng` (English)
4. Connect output to next node (e.g., LLM Node)

### 2. Common Input Patterns

#### From Email Attachment
```javascript
// Input from Email Trigger node
{
  email: {
    attachments: [{
      data: "data:image/png;base64,iVBORw0KGgo...",
      contentType: "image/png"
    }]
  }
}

// OCR Node Input Mapping
imageBase64: {{ email.attachments[0].data }}
```

#### From Webhook
```javascript
// Webhook receives base64 image
{
  body: {
    image: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }
}

// OCR Node Input Mapping
imageBase64: {{ body.image }}
```

#### From File Node
```javascript
// File Node reads file
{
  content: "base64_encoded_file_content"
}

// OCR Node Input Mapping
file: {{ content }}
```

### 3. Output Usage

#### Extract Plain Text
```javascript
// OCR Node Output
{
  text: "Invoice #12345\nAmount: $1,234.56\n...",
  confidence: 0.95,
  metadata: { language: "eng", pages: 1 }
}

// Use in LLM Node
prompt: "Analyze this invoice: {{ ocr.text }}"
```

#### Extract Structured Data (Tables)
```javascript
// OCR Node Output (with extractTables: true)
{
  text: "Full text...",
  structuredData: {
    tables: [
      {
        headers: ["Item", "Quantity", "Price"],
        rows: [
          ["Widget A", "10", "$100"],
          ["Widget B", "5", "$50"]
        ],
        confidence: 0.92
      }
    ]
  }
}

// Use in Transform Node
// Access: {{ ocr.structuredData.tables[0].rows }}
```

#### Extract Form Fields
```javascript
// OCR Node Output (with extractForms: true)
{
  text: "Full text...",
  structuredData: {
    forms: [
      { key: "Name", value: "John Doe", confidence: 0.98 },
      { key: "Email", value: "john@example.com", confidence: 0.95 },
      { key: "Phone", value: "555-1234", confidence: 0.90 }
    ]
  }
}

// Use in Database Node
// Insert: {{ ocr.structuredData.forms }}
```

## Provider Comparison

| Feature | Tesseract | Google | AWS | Azure |
|---------|-----------|--------|-----|-------|
| **Cost** | Free | $1.50/1K pages | $1.50/1K pages | $1.00/1K pages |
| **Accuracy** | 85-90% | 95%+ | 95%+ | 95%+ |
| **Speed** | Medium | Fast | Medium | Fast |
| **Tables** | ❌ | ✅ | ✅✅ | ✅ |
| **Forms** | ❌ | ❌ | ✅✅ | ✅ |
| **Languages** | 100+ | 50+ | 10+ | 25+ |
| **Setup** | Easy | Medium | Medium | Medium |

## Common Workflow Patterns

### Pattern 1: Invoice Processing
```
Email Trigger → OCR (Google, Extract Tables) → Transform → Database
```

### Pattern 2: Receipt Digitization
```
Schedule → File Node → OCR (AWS, Extract Forms) → LLM → CSV
```

### Pattern 3: Document Search
```
Webhook → OCR (Tesseract) → Document Ingestion → Vector Store
```

### Pattern 4: Form Processing
```
Manual Trigger → OCR (AWS, Extract Forms) → Validate → Airtable
```

## Configuration Examples

### Example 1: Simple Text Extraction
```json
{
  "provider": "tesseract",
  "language": "eng",
  "preprocess": true
}
```

### Example 2: Table Extraction
```json
{
  "provider": "google",
  "language": "eng",
  "extractTables": true,
  "preprocess": true
}
```

### Example 3: Form Extraction
```json
{
  "provider": "aws",
  "language": "eng",
  "extractForms": true,
  "extractTables": true
}
```

### Example 4: Multi-language
```json
{
  "provider": "google",
  "language": "spa",  // Spanish
  "preprocess": true
}
```

## Error Handling

### Common Errors

**MISSING_INPUT**
- **Cause**: No input provided to OCR node
- **Fix**: Ensure input is connected and contains image/PDF data

**INVALID_FORMAT**
- **Cause**: Unsupported file format
- **Fix**: Use PNG, JPEG, or PDF formats

**API_KEY_MISSING**
- **Cause**: Cloud provider requires API key
- **Fix**: Add API key in node config or environment variable

**PROCESSING_FAILED**
- **Cause**: OCR processing error
- **Fix**: Check file size, format, and provider availability

## Best Practices

1. **Choose the Right Provider**
   - Use Tesseract for testing and low-volume use
   - Use Google/AWS for production and high accuracy needs
   - Use AWS for forms and tables

2. **Preprocessing**
   - Enable preprocessing for scanned documents
   - Improves accuracy by 5-10%

3. **Language Selection**
   - Always specify language for better accuracy
   - Use auto-detection only if language is unknown

4. **Error Handling**
   - Always add Error Catch node after OCR
   - Log errors for debugging

5. **Performance**
   - Use Tesseract for batch processing (no rate limits)
   - Use cloud providers for real-time processing

## Integration Tips

### With Email Triggers
- OCR runs automatically on image/PDF attachments
- Access via `{{ email.attachments[0].ocrText }}`

### With Document Ingestion
- Scanned PDFs automatically use OCR
- No manual OCR node needed

### With LLM Nodes
- Pass `{{ ocr.text }}` to LLM for analysis
- Use structured data for precise extraction

### With Database Nodes
- Store extracted text in database
- Use structured data for relational storage

## Troubleshooting

### Low Accuracy
- Enable preprocessing
- Use higher-quality images
- Try different provider
- Specify correct language

### Slow Processing
- Use cloud providers (faster than Tesseract)
- Reduce image size before OCR
- Process in parallel for multiple files

### Missing Text
- Check image quality (resolution, contrast)
- Enable preprocessing
- Try different provider
- Verify language setting

## API Reference

### Node Type
```
ai.ocr
```

### Inputs
- `imageUrl` (string): Image URL
- `imageBase64` (string): Base64 image data URI
- `pdfUrl` (string): PDF URL
- `pdfBase64` (string): Base64 PDF data URI
- `file` (string): File path or base64 content

### Outputs
- `text` (string): Extracted plain text
- `structuredData` (object): Tables and forms
- `confidence` (number): Confidence score (0-1)
- `metadata` (object): Processing metadata
- `pages` (array): Per-page results

### Config
- `provider` (string): `tesseract` | `google` | `aws` | `azure` | `openai`
- `language` (string): Language code (e.g., `eng`, `spa`)
- `extractTables` (boolean): Extract tables
- `extractForms` (boolean): Extract form fields
- `preprocess` (boolean): Apply image preprocessing
- `apiKey` (string): API key for cloud providers

