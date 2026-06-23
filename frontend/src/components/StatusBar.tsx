"use client";

import React from "react";
import { useAppStore } from "../stores/appStore";
import { CheckCircle2, XCircle, Clock, Server } from "lucide-react";

export function StatusBar() {
  const { activeProfileId, connections, serverInfo, selectedDatabase, activeTabId, tabs } = useAppStore();
  const activeConnection = connections.find(c => c.id === activeProfileId);
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="h-6 border-t border-border bg-surface flex items-center justify-between px-3 text-[11px] select-none text-text/60 shrink-0">
      <div className="flex items-center space-x-4">
        {activeConnection ? (
          <div className="flex items-center text-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected to {activeConnection.server}
          </div>
        ) : (
          <div className="flex items-center text-text/40">
            <XCircle className="w-3 h-3 mr-1" />
            Not connected
          </div>
        )}
        
        {serverInfo && (
          <div className="flex items-center border-l border-border pl-4">
            <Server className="w-3 h-3 mr-1" />
            {serverInfo.name} {serverInfo.version}
          </div>
        )}

        {selectedDatabase && (
          <div className="flex items-center border-l border-border pl-4 font-mono">
            {selectedDatabase}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {activeTab?.results?.executionTime !== undefined && (
          <div className="flex items-center border-r border-border pr-4">
            <Clock className="w-3 h-3 mr-1.5" />
            {activeTab.results.executionTime}ms
          </div>
        )}
        
        {activeTab?.results?.rowCount !== undefined && (
          <div className="flex items-center font-medium">
            {activeTab.results.rowCount} row{activeTab.results.rowCount !== 1 ? 's' : ''}
          </div>
        )}
        
        <div className="font-mono bg-surface-hover px-2 py-0.5 rounded text-[10px]">
          UniSQL v1.0.0
        </div>
      </div>
    </div>
  );
}
