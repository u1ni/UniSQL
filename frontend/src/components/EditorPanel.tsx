"use client";

import React, { useRef, useEffect } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useAppStore } from "../stores/appStore";
import { FileCode, X, Plus, Play } from "lucide-react";

export function EditorPanel() {
  const { 
    tabs, 
    activeTabId, 
    theme, 
    setActiveTab, 
    addTab, 
    removeTab, 
    updateTabSQL,
    executeQuery,
    activeConnectionId
  } = useAppStore();

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (!monaco) return;

    // Full SQL keyword list
    const SQL_KEYWORDS = [
      'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE',
      'ALTER TABLE', 'DROP TABLE', 'CREATE DATABASE', 'DROP DATABASE', 'USE',
      'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
      'ON', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
      'ORDER BY', 'GROUP BY', 'HAVING', 'DISTINCT', 'TOP', 'AS', 'SET',
      'VALUES', 'INTO', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'EXEC', 'EXECUTE',
      'DECLARE', 'VARCHAR', 'INT', 'BIGINT', 'FLOAT', 'DECIMAL', 'DATE', 'DATETIME',
      'BIT', 'NVARCHAR', 'TEXT', 'NTEXT', 'CHAR', 'NCHAR', 'MONEY',
      'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'CONSTRAINT', 'INDEX',
      'UNIQUE', 'DEFAULT', 'IDENTITY', 'NOT NULL', 'NULL',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'CONVERT', 'ISNULL', 'COALESCE',
      'GETDATE', 'DATEADD', 'DATEDIFF', 'YEAR', 'MONTH', 'DAY',
      'LEN', 'SUBSTRING', 'REPLACE', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM',
      'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT',
      'CREATE PROCEDURE', 'ALTER PROCEDURE', 'DROP PROCEDURE',
      'CREATE VIEW', 'ALTER VIEW', 'DROP VIEW',
      'GRANT', 'REVOKE', 'DENY', 'GO',
      'PRINT', 'RAISERROR', 'THROW', 'TRY', 'CATCH',
      'CURSOR', 'FETCH', 'OPEN', 'CLOSE', 'DEALLOCATE',
      'WHILE', 'IF', 'ELSE', 'BREAK', 'CONTINUE', 'RETURN',
      'SCHEMA_NAME', 'OBJECT_ID', 'DB_NAME', 'SCOPE_IDENTITY', '@@IDENTITY', '@@ROWCOUNT',
    ];

    const disposable = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: ['.', ' ', '['],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];

        // SQL Keywords
        SQL_KEYWORDS.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw + ' ',
            range,
            sortText: '1_' + kw,
          });
        });

        // Database objects from explorer
        const state = useAppStore.getState();
        const explorerData = state.explorerData || [];

        for (const dbNode of explorerData) {
          // Suggest database names
          suggestions.push({
            label: dbNode.label,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `[${dbNode.label}]`,
            detail: 'Database',
            range,
            sortText: '0_' + dbNode.label,
          });

          if (!dbNode.children) continue;

          for (const folder of dbNode.children) {
            if (!folder.children) continue;

            for (const obj of folder.children) {
              if (obj.type === 'table' || obj.type === 'view') {
                const meta = obj.metadata as any;
                const schema = meta?.schema || 'dbo';
                const name = meta?.name || obj.label;
                
                suggestions.push({
                  label: `${schema}.${name}`,
                  kind: obj.type === 'table'
                    ? monaco.languages.CompletionItemKind.Struct
                    : monaco.languages.CompletionItemKind.Interface,
                  insertText: `[${schema}].[${name}]`,
                  detail: obj.type === 'table' ? `Table (${dbNode.label})` : `View (${dbNode.label})`,
                  range,
                  sortText: '0_' + name,
                });

                // Also suggest short name
                suggestions.push({
                  label: name,
                  kind: obj.type === 'table'
                    ? monaco.languages.CompletionItemKind.Struct
                    : monaco.languages.CompletionItemKind.Interface,
                  insertText: name,
                  detail: `${schema} — ${obj.type === 'table' ? 'Table' : 'View'}`,
                  range,
                  sortText: '0_' + name,
                });

                // Suggest columns if loaded
                if (obj.children) {
                  for (const col of obj.children) {
                    const colLabel = col.label.split(' ')[0]; // "ID (int) not null" -> "ID"
                    suggestions.push({
                      label: colLabel,
                      kind: monaco.languages.CompletionItemKind.Field,
                      insertText: colLabel,
                      detail: `Column — ${schema}.${name}`,
                      range,
                      sortText: '0_' + colLabel,
                    });
                  }
                }
              } else if (obj.type === 'procedure') {
                const meta = obj.metadata as any;
                const schema = meta?.schema || 'dbo';
                const name = meta?.name || obj.label;
                suggestions.push({
                  label: `${schema}.${name}`,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: `[${schema}].[${name}]`,
                  detail: `Procedure (${dbNode.label})`,
                  range,
                  sortText: '0_' + name,
                });
              }
            }
          }
        }

        return { suggestions };
      }
    });

    return () => disposable.dispose();
  }, [monaco]);

  const handleExecute = () => {
    if (!activeTabId || !activeConnectionId) return;
    
    let selectedText = undefined;
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        selectedText = editorRef.current.getModel().getValueInRange(selection);
      }
    }
    
    executeQuery(activeTabId, selectedText);
  };

  useEffect(() => {
    const handleGlobalExecute = () => handleExecute();
    window.addEventListener('unisql:execute', handleGlobalExecute);
    return () => window.removeEventListener('unisql:execute', handleGlobalExecute);
  }, [activeTabId, activeConnectionId, executeQuery]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    
    useAppStore.setState({
      getEditorSelection: () => {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
          return editor.getModel().getValueInRange(selection);
        }
        return undefined;
      }
    });
    
    // Add F5 shortcut to execute
    editor.addCommand(monacoInstance.KeyCode.F5, handleExecute);

    // Add Ctrl+Enter shortcut
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, handleExecute);

    // Add Ctrl+S shortcut to save
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      const state = useAppStore.getState();
      if (state.activeTabId) {
        state.saveTab(state.activeTabId);
      }
    });
  };

  const handleChange = (value: string | undefined) => {
    if (activeTabId && value !== undefined) {
      updateTabSQL(activeTabId, value);
    }
  };

  const getMonacoTheme = () => {
    if (theme === 'dark') return 'vs-dark';
    if (theme === 'light') return 'light';
    return 'vs-dark'; // Default fallback
  };

  if (tabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-bg">
        <FileCode className="w-16 h-16 text-border mb-4" />
        <h2 className="text-xl font-medium text-text mb-2">No queries open</h2>
        <p className="text-text/50 mb-6 max-w-md">
          Open a new query tab to start writing SQL, or double-click a table in the Object Explorer.
        </p>
        <button 
          onClick={() => addTab()}
          className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" /> New Query (Ctrl+N)
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Tabs bar */}
      <div className="flex items-end h-10 border-b border-border bg-surface/50 overflow-x-auto overflow-y-hidden hide-scrollbar">
        {tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r border-border border-t cursor-pointer select-none transition-colors
              ${activeTabId === tab.id 
                ? "bg-bg text-accent border-t-accent/50 border-t-2 font-medium" 
                : "bg-surface text-text/60 border-t-transparent hover:bg-surface-hover hover:text-text"}
            `}
          >
            <FileCode className="w-3.5 h-3.5 mr-2 shrink-0 opacity-70" />
            <span className="truncate text-sm flex-1">{tab.title}</span>
            <div className="w-2 h-2 rounded-full bg-accent/80 shrink-0 ml-2 hidden" /> {/* Modified indicator */}
            <button 
              onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
              className={`
                p-0.5 rounded ml-1 text-text/40 hover:bg-surface-hover hover:text-error shrink-0
                ${activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              `}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button 
          onClick={() => addTab()}
          className="h-8 w-8 flex items-center justify-center text-text/50 hover:bg-surface-hover hover:text-text m-1 rounded"
          title="New Query Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative bg-bg">
        {activeTab && (
          <Editor
            height="100%"
            language="sql"
            theme={getMonacoTheme()}
            value={activeTab.sql}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              lineHeight: 1.5,
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: true,
              renderLineHighlight: "all",
              guides: { bracketPairs: true, indentation: true }
            }}
            loading={
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            }
          />
        )}

      </div>
    </div>
  );
}
