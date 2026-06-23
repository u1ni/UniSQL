"use client";

import React, { useState } from "react";
import { useAppStore } from "../stores/appStore";
import { Bot, Settings, Send, Wand2, BookOpen, X, Loader2 } from "lucide-react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AIChatPanel() {
  const { activeTabId, tabs, selectedDatabase } = useAppStore();
  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // Settings state
  const [provider, setProvider] = useState<'openai' | 'ollama' | 'anthropic' | 'gemini'>('ollama');
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama3");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Fetch AI config and models on mount
  React.useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
    fetch(`${apiBase}/api/ai/config`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setProvider(data.config.provider || 'ollama');
          setModel(data.config.model || 'llama3');
          setOllamaUrl(data.config.ollamaUrl || 'http://localhost:11434');
          if (data.config.apiKey) setApiKey(data.config.apiKey);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch Ollama models when settings are open and provider is ollama
  React.useEffect(() => {
    if (view === 'settings' && provider === 'ollama') {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
      fetch(`${apiBase}/api/ai/models`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.models) {
            setAvailableModels(data.models);
            // If current model is not in the list and list is not empty, auto-select first
            if (data.models.length > 0 && !data.models.includes(model)) {
              setModel(data.models[0]);
            }
          }
        })
        .catch(console.error);
    }
  }, [view, provider]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    const userMsg = text.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");
    setIsTyping(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
      const res = await fetch(`${apiBase}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-connection-id": useAppStore.getState().activeConnectionId || "" },
        body: JSON.stringify({ message: userMsg, database: selectedDatabase })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textError = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${textError.substring(0, 100)}...`);
      }

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Network Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = async (endpoint: string, actionName: string) => {
    if (!activeTab?.sql.trim()) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Please write or select a query in the editor to ${actionName.toLowerCase()} it.` }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: `Please ${actionName.toLowerCase()} this query:\n\`\`\`sql\n${activeTab.sql}\n\`\`\`` }]);
    setIsTyping(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
      const res = await fetch(`${apiBase}/api/ai/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-connection-id": useAppStore.getState().activeConnectionId || "" },
        body: JSON.stringify({ sql: activeTab.sql, database: selectedDatabase })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textError = await res.text();
        throw new Error(`Server returned non-JSON response (${res.status}): ${textError.substring(0, 100)}...`);
      }

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.explanation || data.optimization }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Network Error: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const saveSettings = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
      await fetch(`${apiBase}/api/ai/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, ollamaUrl })
      });
      setView('chat');
    } catch (err) {
      console.error("Failed to save AI config", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between p-3 border-b border-border bg-surface/80">
        <h2 className="font-medium flex items-center text-accent">
          <Bot className="w-5 h-5 mr-2" /> UniSQL AI
        </h2>
        <div className="flex gap-1">
          <button 
            onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}
            className={`p-1.5 rounded transition-colors ${view === 'settings' ? 'bg-accent/20 text-accent' : 'text-text/50 hover:text-text hover:bg-surface-hover'}`}
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={() => useAppStore.setState({ showAIPanel: false })}
            className="p-1.5 rounded text-text/50 hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'settings' ? (
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <h3 className="text-sm font-medium mb-2">AI Configuration</h3>
          
          <div className="space-y-2">
            <label className="text-xs text-text/70 uppercase">Provider</label>
            <div className="flex gap-2">
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text/70 uppercase">Model Name</label>
            {provider === 'ollama' && availableModels.length > 0 ? (
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <Input 
                value={model} 
                onChange={(e) => setModel(e.target.value)} 
                placeholder={provider === 'ollama' ? "llama3" : provider === 'anthropic' ? "claude-3-haiku-20240307" : provider === 'gemini' ? "gemini-1.5-flash" : "gpt-4o"}
              />
            )}
          </div>

          {provider === 'ollama' ? (
            <Input 
              label="Ollama URL" 
              value={ollamaUrl} 
              onChange={(e) => setOllamaUrl(e.target.value)} 
              placeholder="http://localhost:11434"
            />
          ) : (
            <Input 
              label="API Key" 
              type="password"
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder="sk-..."
            />
          )}

          <Button variant="primary" className="w-full mt-4" onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="p-2 border-b border-border/50 flex gap-2 shrink-0 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => handleAction('explain', 'Explain')}
              className="flex items-center px-2.5 py-1.5 text-xs bg-bg border border-border hover:border-accent/50 rounded-full whitespace-nowrap transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Explain Query
            </button>
            <button 
              onClick={() => handleAction('optimize', 'Optimize')}
              className="flex items-center px-2.5 py-1.5 text-xs bg-bg border border-border hover:border-accent/50 rounded-full whitespace-nowrap transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Optimize
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-text/40 text-sm mt-10">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Hello! I'm your UniSQL AI assistant.</p>
                <p className="mt-1 text-xs">Ask me about your database schema or have me write SQL for you.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-accent text-white rounded-br-none' 
                        : 'bg-surface-hover border border-border rounded-bl-none text-text/90'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-surface-hover border border-border rounded-xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-border bg-surface shrink-0">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="relative flex items-center"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI to write a query..." 
                className="w-full bg-bg border border-border rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                disabled={isTyping}
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-1.5 p-1.5 rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:hover:bg-accent transition-colors"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
