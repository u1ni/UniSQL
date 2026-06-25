"use client";

import React, { useRef, useEffect, useState } from "react";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { Sidebar } from "./Sidebar";
import { EditorPanel } from "./EditorPanel";
import { ResultsPanel } from "./ResultsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { AIChatPanel } from "./AIChatPanel";
import { ConnectionDialog } from "./ConnectionDialog";
import { CommandPalette } from "./CommandPalette";
import { useAppStore } from "../stores/appStore";

export function Layout() {
  const { 
    sidebarWidth, 
    resultsPanelHeight, 
    showHistoryPanel, 
    showAIPanel, 
    showConnectionDialog,

  } = useAppStore();

  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingResults, setIsDraggingResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      if (isDraggingSidebar) {
        const newWidth = Math.max(200, Math.min(e.clientX, 600));
        useAppStore.setState({ sidebarWidth: newWidth });
      }
      
      if (isDraggingResults) {
        const containerRect = containerRef.current.getBoundingClientRect();
        // Calculate height from bottom
        const newHeight = Math.max(100, Math.min(containerRect.bottom - e.clientY, containerRect.height - 200));
        useAppStore.setState({ resultsPanelHeight: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      setIsDraggingResults(false);
      document.body.style.cursor = 'default';
    };

    if (isDraggingSidebar || isDraggingResults) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isDraggingSidebar ? 'col-resize' : 'row-resize';
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDraggingSidebar, isDraggingResults,]);

  return (
    <div className="flex flex-col h-screen w-full bg-bg text-text overflow-hidden font-sans">
      <Toolbar />
      
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 border-r border-border bg-surface/50">
          <Sidebar />
        </div>
        
        {/* Resize Handle Sidebar */}
        <div 
          className="w-1 cursor-col-resize hover:bg-accent/50 active:bg-accent transition-colors z-10 shrink-0"
          onMouseDown={() => setIsDraggingSidebar(true)}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Area */}
          <div className="flex-1 min-h-0">
            <EditorPanel />
          </div>
          
          {/* Resize Handle Results */}
          <div 
            className="h-1 cursor-row-resize hover:bg-accent/50 active:bg-accent transition-colors z-10 shrink-0"
            onMouseDown={() => setIsDraggingResults(true)}
          />
          
          {/* Results Area */}
          <div style={{ height: resultsPanelHeight }} className="flex-shrink-0 border-t border-border">
            <ResultsPanel />
          </div>
        </div>

        {/* Slide-in Panels */}
        {showHistoryPanel && (
          <div className="absolute right-0 top-0 bottom-0 w-80 shadow-2xl z-20 border-l border-border bg-surface animate-slide-left">
            <HistoryPanel />
          </div>
        )}
        
        {showAIPanel && (
          <div className="absolute right-0 top-0 bottom-0 w-96 shadow-2xl z-20 border-l border-border bg-surface animate-slide-left">
            <AIChatPanel />
          </div>
        )}
      </div>
      
      <StatusBar />
      
      <CommandPalette />
      <ConnectionDialog isOpen={showConnectionDialog} />
    </div>
  );
}
