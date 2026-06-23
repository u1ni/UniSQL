"use client";

import React from "react";
import { useAppStore } from "../stores/appStore";
import { Clock, Search, Trash2 } from "lucide-react";

export function HistoryPanel() {
  const { history, loadHistory } = useAppStore();

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all history?")) {
      try {
        await fetch("/api/history", { method: "DELETE" });
        loadHistory();
      } catch (err) {
        console.error("Failed to clear history", err);
      }
    }
  };

  const handleLoadQuery = (sql: string, db: string) => {
    if (db) useAppStore.setState({ selectedDatabase: db });
    useAppStore.getState().addTab(sql);
    useAppStore.setState({ showHistoryPanel: false });
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="font-medium flex items-center">
          <Clock className="w-4 h-4 mr-2 text-accent" /> Query History
        </h2>
        <button 
          onClick={() => useAppStore.setState({ showHistoryPanel: false })}
          className="text-text/50 hover:text-text p-1"
        >
          ×
        </button>
      </div>

      <div className="p-2 border-b border-border/50 bg-bg/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text/40" />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="w-full bg-surface border border-border rounded pl-7 pr-2 py-1 text-xs focus:border-accent outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {history.length === 0 ? (
          <div className="text-center p-4 text-text/40 text-sm">
            No history available
          </div>
        ) : (
          history.map((entry, i) => (
            <div 
              key={i}
              className="p-3 border border-border rounded-lg bg-bg hover:border-accent/50 cursor-pointer transition-colors group"
              onClick={() => handleLoadQuery(entry.sql, entry.database)}
            >
              <div className="text-xs font-mono text-text/90 line-clamp-3 break-words whitespace-pre-wrap mb-2">
                {entry.sql}
              </div>
              <div className="flex justify-between items-center text-[10px] text-text/50">
                <div className="flex gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-surface border border-border/50">{entry.database}</span>
                  <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {entry.executionTime}ms</span>
                </div>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t border-border">
        <button 
          onClick={handleClearHistory}
          disabled={history.length === 0}
          className="w-full flex items-center justify-center gap-2 p-1.5 text-xs text-error/70 hover:text-error hover:bg-error/10 rounded transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear History
        </button>
      </div>
    </div>
  );
}
