import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../contexts/ThemeContext';

interface CodeEditorProps {
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  placeholder?: string;
}

export function CodeEditor({
  language,
  value,
  onChange,
  height = '400px',
  readOnly = false,
  placeholder,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<any>(null);

  const handleEditorMount = (editor: any, monaco: any) => {
    // Stop event propagation to prevent ReactFlow from capturing events
    const editorContainer = editor.getContainerDomNode();
    if (editorContainer) {
      editorContainer.addEventListener('click', (e: MouseEvent) => e.stopPropagation());
      editorContainer.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());
      editorContainer.addEventListener('keydown', (e: KeyboardEvent) => e.stopPropagation());
    }
    handleEditorDidMount(editor, monaco);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly,
      cursorStyle: readOnly ? 'line' : 'line',
      contextmenu: !readOnly,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
      insertSpaces: true,
    });

    // Add language-specific configurations
    if (language === 'python') {
      monaco.languages.setLanguageConfiguration('python', {
        comments: {
          lineComment: '#',
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')'],
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" },
        ],
      });
    }

    // Add placeholder if provided
    if (placeholder && !value) {
      editor.setValue(placeholder);
      editor.setPosition({ lineNumber: 1, column: 1 });
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden" style={{ minHeight: height }}>
      <Editor
        height={height}
        language={language}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          readOnly,
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          insertSpaces: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,
          roundedSelection: false,
          cursorStyle: readOnly ? 'line' : 'line',
          contextmenu: !readOnly,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          acceptSuggestionOnCommitCharacter: true,
          snippetSuggestions: 'top',
          wordBasedSuggestions: 'allDocuments',
        }}
      />
    </div>
  );
}

