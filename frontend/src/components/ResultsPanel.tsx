"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "../stores/appStore";
import { Download, Table as TableIcon, MessageSquare, AlertCircle, CheckCircle2, Grid3X3 } from "lucide-react";
import type { ResultSet, ResultSetColumn } from "@/lib/api";

export function ResultsPanel() {
  const { tabs, activeTabId, exportResults } = useAppStore();
  const [activeView, setActiveView] = useState<'results' | 'messages'>('results');
  const [activeResultSetIndex, setActiveResultSetIndex] = useState(0);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const results = activeTab?.results;

  // Compute the list of result sets to display
  const resultSets: ResultSet[] = useMemo(() => {
    if (!results) return [];
    if (results.resultSets && results.resultSets.length > 0) {
      return results.resultSets;
    }
    // Fallback: build a single result set from the primary columns/rows
    if (results.columns && results.columns.length > 0) {
      return [{
        index: 0,
        columns: results.columns,
        rows: results.rows || [],
        rowCount: results.rows?.length || 0,
      }];
    }
    return [];
  }, [results]);

  // Clamp activeResultSetIndex if it exceeds available result sets
  const safeIndex = Math.min(activeResultSetIndex, Math.max(0, resultSets.length - 1));
  const currentResultSet = resultSets[safeIndex] || null;

  // Total row count across all result sets for badge display
  const totalRows = resultSets.reduce((sum, rs) => sum + rs.rowCount, 0);

  if (!activeTabId || !activeTab) {
    return <div className="h-full bg-surface flex items-center justify-center text-text/40">No active tab</div>;
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Panel Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 h-9 shrink-0 bg-surface/80">
        <div className="flex space-x-6">
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors flex items-center ${activeView === 'results' ? 'bg-bg text-accent border-b-2 border-b-accent' : 'text-text/60 hover:text-text hover:bg-surface-hover'}`}
            onClick={() => setActiveView('results')}
          >
            <TableIcon className="w-4 h-4 mr-2" /> Results 
            {totalRows > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-bold">{totalRows}</span>}
          </button>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors flex items-center ${activeView === 'messages' ? 'bg-bg text-accent border-b-2 border-b-accent' : 'text-text/60 hover:text-text hover:bg-surface-hover'}`}
            onClick={() => setActiveView('messages')}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Messages
            {results?.messages?.some((m: any) => m.type === 'error') && <span className="ml-2 w-2.5 h-2.5 rounded-full bg-error" />}
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          {activeView === 'results' && currentResultSet && currentResultSet.rows.length > 0 && (
            <div className="relative group">
              <button className="p-1.5 text-text/60 hover:text-text rounded transition-colors flex items-center text-xs">
                <Download className="w-3.5 h-3.5 mr-1" /> Export
              </button>
              <div className="absolute right-0 bottom-full pb-1 hidden group-hover:block z-50">
                <div className="w-32 bg-surface border border-border rounded shadow-lg overflow-hidden">
                  <button 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10"
                    onClick={() => exportResults(activeTabId, 'csv')}
                  >
                    Save as CSV
                  </button>
                  <button 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10"
                    onClick={() => exportResults(activeTabId, 'json')}
                  >
                    Save as JSON
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-bg relative">
        {activeTab.isExecuting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg/50 backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mb-4"></div>
            <div className="text-sm font-medium text-accent animate-pulse">Executing query...</div>
            <div className="text-xs text-text/50 mt-2 font-mono">00:00:00</div>
          </div>
        ) : null}

        {activeView === 'results' ? (
          <div className="flex flex-col h-full">
            {/* Result Set sub-tabs — only show if > 1 result set */}
            {resultSets.length > 1 && (
              <div className="flex border-b border-border/50 p-1.5 gap-2 shrink-0 bg-surface/50">
                {resultSets.map((rs, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveResultSetIndex(i)}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors flex items-center gap-2 whitespace-nowrap ${
                      i === safeIndex
                        ? 'bg-accent/15 text-accent border border-accent/30 shadow-sm'
                        : 'text-text/60 hover:text-text/90 hover:bg-surface-hover border border-transparent'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Result {i + 1}
                    <span className={`px-1.5 py-0.5 ml-2 rounded text-[10px] font-bold ${i === safeIndex ? 'bg-accent/20 text-accent' : 'bg-surface border border-border text-text/50'}`}>
                      {rs.rowCount} rows
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Actual grid */}
            <div className="flex-1 overflow-auto bg-bg-secondary p-2">
              <ResultsGrid resultSet={currentResultSet} results={results} />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto bg-bg-secondary p-2">
            <MessagesView results={results} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsGrid({ resultSet, results }: { resultSet: ResultSet | null; results: any }) {
  if (!results) {
    return <div className="p-4 text-sm text-text/40">Run a query to see results.</div>;
  }

  const errorMsg = results.messages?.find((m: any) => m.type === 'error');
  if (errorMsg) {
    return (
      <div className="p-4 text-error font-mono text-sm whitespace-pre-wrap bg-error/5 rounded-md border border-error/20">
        <AlertCircle className="w-5 h-5 inline mr-2 mb-1" />
        {errorMsg.text}
      </div>
    );
  }

  if (!resultSet || !resultSet.columns || resultSet.columns.length === 0) {
    return (
      <div className="p-4 text-text/60 text-sm flex items-center bg-success/5 rounded-md border border-success/20">
        <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
        Command(s) completed successfully.
      </div>
    );
  }

  return (
    <div className="inline-block min-w-full bg-surface border border-border rounded-md shadow-sm overflow-hidden relative">
      <table className="min-w-full text-left border-collapse font-mono text-[13px]">
        <thead className="sticky top-0 bg-surface-active z-10 shadow-sm border-b border-border">
          <tr>
            <th className="px-4 py-2.5 text-text/50 font-semibold border-r border-border/50 w-16 text-right whitespace-nowrap bg-surface-active">#</th>
            {resultSet.columns.map((col: ResultSetColumn, i: number) => (
              <th key={i} className="px-3 py-2.5 text-text/80 font-medium border-r border-border/50 whitespace-nowrap bg-surface-active">
                {col.name || `(No column name)`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resultSet.rows.map((row: any, i: number) => (
            <tr key={i} className="border-b border-border/30 hover:bg-accent/5 transition-colors group">
              <td className="px-3 py-1.5 text-text/30 border-r border-border/50 bg-surface/30 group-hover:bg-accent/10 text-right select-none">
                {i + 1}
              </td>
              {resultSet.columns.map((col: ResultSetColumn, j: number) => {
                const val = row[col.name || ''];
                let displayVal = val;
                let isNull = val === null || val === undefined;
                
                if (isNull) displayVal = 'NULL';
                else if (typeof val === 'object') displayVal = JSON.stringify(val);
                else if (typeof val === 'boolean') displayVal = val ? '1' : '0';
                
                return (
                  <td 
                    key={j} 
                    className={`px-3 py-1.5 border-r border-border/50 whitespace-nowrap ${isNull ? 'text-text/30 italic' : 'text-text/90'}`}
                  >
                    {String(displayVal)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesView({ results }: { results: any }) {
  if (!results) {
    return <div className="p-4 text-sm text-text/40">No messages.</div>;
  }

  const errorMsg = results.messages?.find((m: any) => m.type === 'error');

  return (
    <div className="p-4 font-mono text-sm space-y-3">
      {errorMsg && (
        <div className="text-error flex items-start">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{errorMsg.text}</span>
        </div>
      )}
      
      {results.messages?.filter((m: any) => m.type !== 'error').map((msg: any, i: number) => (
        <div key={i} className="text-text/80 whitespace-pre-wrap">
          {msg.text || msg.message}
        </div>
      ))}
      
      {/* Show per-statement rowsAffected if available */}
      {results.rowsAffected && results.rowsAffected.length > 0 && !errorMsg && (
        <div className="text-text/60 mt-4 pt-2 border-t border-border/50 space-y-1">
          {results.rowsAffected.map((count: number, i: number) => (
            <div key={i} className="flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
              ({count} row(s) affected)
            </div>
          ))}
        </div>
      )}

      {!results.rowsAffected && results.rowCount !== undefined && !errorMsg && (
        <div className="text-text/60 mt-4 pt-2 border-t border-border/50 flex items-center">
          <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
          ({results.rowCount} row(s) affected)
        </div>
      )}

      {results.executionTime !== undefined && (
        <div className="text-text/40 text-xs mt-2">
          Execution time: {results.executionTime}ms
        </div>
      )}
    </div>
  );
}
