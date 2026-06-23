"use client";

import React from "react";
import { Play, Square, Settings, FileCode, Clock, MessageSquare, Moon, Sun, Monitor, Menu, Save, FolderOpen } from "lucide-react";
import { useAppStore } from "../stores/appStore";

export function Toolbar() {
  const { 
    activeConnectionId, 
    activeProfileId,
    connections,
    activeTabId,
    tabs,
    theme,
    setTheme,
    executeQuery,
    addTab,
    showHistoryPanel,
    showAIPanel,

  } = useAppStore();

  const activeConnection = connections.find(c => c.id === activeProfileId);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleSave = () => {
    if (activeTabId) useAppStore.getState().saveTab(activeTabId);
  };

  const handleOpen = () => {
    useAppStore.getState().openFile();
  };

  return (
    <div className="h-12 border-b border-border bg-surface flex items-center justify-between px-4 select-none shrink-0">
      {/* Left section: Logo and connection info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center text-accent font-bold tracking-tight">
          <DatabaseIcon className="w-5 h-5 mr-2" />
          UniSQL
        </div>
        
        <div className="h-5 w-px bg-border mx-2" />
        
        {activeConnection ? (
          <div className="flex items-center text-sm">
            <span className="flex items-center w-2 h-2 rounded-full bg-success mr-2 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
            <span className="text-text font-medium">{activeConnection.name}</span>
            <span className="text-text/50 text-xs ml-2 font-mono">{activeConnection.server}</span>
          </div>
        ) : (
          <div className="flex items-center text-sm text-text/50">
            <span className="flex items-center w-2 h-2 rounded-full bg-border mr-2"></span>
            Disconnected
          </div>
        )}
      </div>

      {/* Middle section: Actions */}
      <div className="flex items-center space-x-1">
        <ToolbarButton 
          icon={<Play className="w-4 h-4" />} 
          label="Execute (F5)" 
          onClick={() => {
            if (activeTabId) {
              window.dispatchEvent(new CustomEvent('unisql:execute'));
            }
          }}
          disabled={!activeConnectionId || !activeTab || activeTab.isExecuting}
          primary
        />
        <ToolbarButton 
          icon={<Square className="w-4 h-4" />} 
          label="Stop" 
          onClick={() => {
            if (activeTabId) useAppStore.getState().cancelQuery(activeTabId);
          }}
          disabled={!activeTab?.isExecuting}
          danger={activeTab?.isExecuting}
        />
        <div className="h-4 w-px bg-border mx-1" />
        <ToolbarButton 
          icon={<FileCode className="w-4 h-4" />} 
          label="New Query (Ctrl+N)" 
          onClick={() => addTab()}
        />
        <ToolbarButton 
          icon={<FolderOpen className="w-4 h-4" />} 
          label="Open File" 
          onClick={handleOpen}
        />
        <ToolbarButton 
          icon={<Save className="w-4 h-4" />} 
          label="Save File (Ctrl+S)" 
          onClick={handleSave}
          disabled={!activeTab || !activeTab.sql}
        />
      </div>

      {/* Right section: Panels and settings */}
      <div className="flex items-center space-x-2">
        <ToolbarButton 
          icon={<Clock className="w-4 h-4" />} 
          label="History" 
          onClick={() => useAppStore.setState({ showHistoryPanel: !showHistoryPanel })}
          active={showHistoryPanel}
        />
        <ToolbarButton 
          icon={<MessageSquare className="w-4 h-4" />} 
          label="AI Assistant" 
          onClick={() => useAppStore.setState({ showAIPanel: !showAIPanel })}
          active={showAIPanel}
        />
        
        <div className="relative group">
          <ToolbarButton icon={<ThemeIcon theme={theme} />} label="Theme" />
          <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50">
            <div className="w-32 bg-surface border border-border rounded-md shadow-lg overflow-hidden">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center" onClick={() => setTheme('dark')}>
                <Moon className="w-4 h-4 mr-2" /> Dark
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center" onClick={() => setTheme('light')}>
                <Sun className="w-4 h-4 mr-2" /> Light
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, disabled, primary, active, danger }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      title={label}
      className={`
        p-2 rounded-md flex items-center transition-colors mx-0.5
        ${disabled ? 'opacity-50 cursor-not-allowed text-text/40' : 
          danger ? 'text-error hover:bg-error/10 animate-pulse' :
          primary ? 'text-success hover:bg-success/10' : 
          active ? 'bg-accent/20 text-accent' :
          'text-text/70 hover:bg-surface-hover hover:text-text'}
      `}
    >
      {React.cloneElement(icon, { className: "w-5 h-5" })}
    </button>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
      <path d="M3 12A9 3 0 0 0 21 12"></path>
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === 'dark') return <Moon className="w-4 h-4" />;
  if (theme === 'light') return <Sun className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}
