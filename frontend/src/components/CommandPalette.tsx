"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import { Search, Play, FileCode, Clock, MessageSquare, Moon, Sun, Wand2, BookOpen, Save, FolderOpen } from "lucide-react";

interface Command {
  id: string;
  name: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: "Query" | "AI" | "View" | "File";
}

export function CommandPalette() {
  const { 
    showCommandPalette, 
    activeTabId, 
    tabs, 
    theme,
    toggleCommandPalette,
    executeQuery,
    addTab,
    saveTab,
    openFile,
    formatCurrentSQL,
    setTheme
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Define commands
  const commands: Command[] = [
    {
      id: "run-query",
      name: "Run Query",
      icon: <Play className="w-4 h-4" />,
      shortcut: "F5",
      category: "Query",
      action: () => activeTabId && executeQuery(activeTabId)
    },
    {
      id: "format-sql",
      name: "Format SQL",
      icon: <Wand2 className="w-4 h-4" />,
      shortcut: "Shift+Alt+F",
      category: "Query",
      action: () => formatCurrentSQL()
    },
    {
      id: "ai-explain",
      name: "AI Explain Query",
      icon: <BookOpen className="w-4 h-4" />,
      category: "AI",
      action: () => {
        useAppStore.setState({ showAIPanel: true });
        // Optionally trigger explain if we had an event bus or just open panel
      }
    },
    {
      id: "ai-optimize",
      name: "AI Optimize Query",
      icon: <Wand2 className="w-4 h-4 text-amber-400" />,
      category: "AI",
      action: () => {
        useAppStore.setState({ showAIPanel: true });
      }
    },
    {
      id: "new-query",
      name: "New Query Tab",
      icon: <FileCode className="w-4 h-4" />,
      shortcut: "Ctrl+N",
      category: "File",
      action: () => addTab()
    },
    {
      id: "open-file",
      name: "Open SQL File",
      icon: <FolderOpen className="w-4 h-4" />,
      shortcut: "Ctrl+O",
      category: "File",
      action: () => openFile()
    },
    {
      id: "save-file",
      name: "Save Query",
      icon: <Save className="w-4 h-4" />,
      shortcut: "Ctrl+S",
      category: "File",
      action: () => activeTabId && saveTab(activeTabId)
    },
    {
      id: "toggle-history",
      name: "Show Query History",
      icon: <Clock className="w-4 h-4" />,
      category: "View",
      action: () => useAppStore.getState().toggleHistoryPanel()
    },
    {
      id: "toggle-ai",
      name: "Show AI Assistant",
      icon: <MessageSquare className="w-4 h-4" />,
      category: "View",
      action: () => useAppStore.getState().toggleAIPanel()
    },
    {
      id: "theme-dark",
      name: "Theme: Dark Mode",
      icon: <Moon className="w-4 h-4" />,
      category: "View",
      action: () => setTheme('dark')
    },
    {
      id: "theme-light",
      name: "Theme: Light Mode",
      icon: <Sun className="w-4 h-4" />,
      category: "View",
      action: () => setTheme('light')
    }
  ];

  // Filter commands
  const filteredCommands = commands.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) || 
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Flatten for keyboard navigation
  const flatNavList = Object.values(groupedCommands).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        toggleCommandPalette();
      } else if (e.key === 'F1') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCommandPalette]);

  useEffect(() => {
    if (showCommandPalette) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCommandPalette]);

  if (!showCommandPalette) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flatNavList.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatNavList[selectedIndex];
      if (cmd) {
        cmd.action();
        toggleCommandPalette();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      toggleCommandPalette();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm" onClick={() => toggleCommandPalette()}>
      <div 
        className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-down"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-border bg-bg">
          <Search className="w-5 h-5 text-text/50 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-text placeholder-text/40 text-base"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono text-text/50 bg-surface border border-border rounded">ESC</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-2 hide-scrollbar">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-text/40 uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = flatNavList.indexOf(cmd);
                const isSelected = globalIndex === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                      isSelected ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-hover'
                    }`}
                    onClick={() => {
                      cmd.action();
                      toggleCommandPalette();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <div className="flex items-center">
                      <span className={`mr-3 ${isSelected ? 'text-accent' : 'text-text/60'}`}>
                        {cmd.icon}
                      </span>
                      {cmd.name}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-1 text-xs font-mono text-text/50 border border-border/50 rounded bg-bg/50">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {flatNavList.length === 0 && (
            <div className="px-4 py-8 text-center text-text/50 text-sm">
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
