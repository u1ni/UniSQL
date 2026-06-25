"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { useAppStore } from '../stores/appStore';
import { SavedConnection, ConnectionConfig } from '../lib/api';
import { Database, Server, User, Key, Save, Trash2, Shield, Network, Play, X, CheckCircle2, XCircle } from "lucide-react";

interface ConnectionDialogProps {
  isOpen: boolean;
}

export function ConnectionDialog({ isOpen }: ConnectionDialogProps) {
  const { 
    connections, 
    activeConnectionId, 
    connectToServer, 
    disconnectFromServer, 

  } = useAppStore();

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
    server: "localhost",
    port: 1433,
    user: "sa",
    password: "",
    database: "",
    encrypt: false,
    trustServerCertificate: true
  });

  const [name, setName] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  // Load selected connection into form
  useEffect(() => {
    if (selectedConnectionId) {
      const conn = connections.find(c => c.id === selectedConnectionId);
      if (conn) {
        setFormData(conn);
        setName(conn.name);
        setTestResult(null);
      }
    } else {
      // New connection
      setFormData({
        server: "localhost",
        port: 1433,
        user: "sa",
        password: "",
        database: "",
        encrypt: false, trustServerCertificate: true
      });
      setName("");
      setTestResult(null);
    }
  }, [selectedConnectionId, connections]);

  const handleChange = (field: keyof ConnectionConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleOptionChange = (field: string, value: boolean) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: value 
    }));
  };

  const handleClose = () => {
    useAppStore.setState({ showConnectionDialog: false });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTestResult({ success: true, message: `Connected successfully. Server: ${data.name} ${data.version}` });
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectToServer(formData as ConnectionConfig);
      handleClose();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Failed to connectToServer" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!(name || "").trim()) {
      setTestResult({ success: false, message: "Please enter a connection name" });
      return;
    }

    try {
      const payload = { ...formData, name };
      const url = selectedConnectionId ? `/api/connections/${selectedConnectionId}` : "/api/connections";
      const method = selectedConnectionId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        // Refresh connections (should be handled by a fetchConnections action in store ideally)
        setTestResult({ success: true, message: "Connection saved successfully" });
      } else {
        const data = await res.json();
        setTestResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network error" });
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Connect to SQL Server"
      maxWidth="max-w-4xl"
    >
      <div className="flex h-[500px]">
        {/* Left sidebar: Saved connections */}
        <div className="w-1/3 border-r border-border/50 pr-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-text/70 uppercase tracking-wider">Saved Connections</h3>
            <button 
              onClick={() => setSelectedConnectionId(null)}
              className="text-accent hover:text-accent/80 text-sm flex items-center"
            >
              <span className="text-lg mr-1">+</span> New
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {connections.length === 0 ? (
              <div className="text-sm text-text/40 text-center mt-8">No saved connections</div>
            ) : (
              connections.map(conn => (
                <div 
                  key={conn.id}
                  onClick={() => setSelectedConnectionId(conn.id!)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedConnectionId === conn.id 
                      ? "bg-accent/10 border-accent/50 text-accent" 
                      : "bg-surface border-border hover:border-border-hover"}
                  `}
                >
                  <div className="font-medium">{conn.name}</div>
                  <div className="text-xs text-text/50 truncate flex items-center mt-1">
                    <Server className="w-3 h-3 mr-1" />
                    {conn.server}:{conn.port}
                  </div>
                  {activeConnectionId === conn.id && (
                    <div className="text-[10px] mt-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-success/20 text-success">
                      <span className="w-1.5 h-1.5 rounded-full bg-success mr-1"></span>
                      Active
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right side: Form */}
        <div className="w-2/3 pl-6 flex flex-col">
          <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Connection Name (optional)" 
                value={name || ""} 
                onChange={(e) => setName(e.target.value)}
                placeholder="My Local DB"
                className="col-span-2"
              />
              
              <Input 
                label="Server" 
                value={formData.server || ""} 
                onChange={(e) => handleChange("server", e.target.value)}
                icon={<Server className="w-4 h-4 text-text/50" />}
                required
              />
              
              <Input 
                label="Port" 
                type="number"
                value={formData.port?.toString() || "1433"} 
                onChange={(e) => handleChange("port", parseInt(e.target.value))}
                icon={<Network className="w-4 h-4 text-text/50" />}
              />
              
              <Input 
                label="Username" 
                value={formData.user || ""} 
                onChange={(e) => handleChange("user", e.target.value)}
                icon={<User className="w-4 h-4 text-text/50" />}
                required
              />
              
              <Input 
                label="Password" 
                type="password"
                value={formData.password || ""} 
                onChange={(e) => handleChange("password", e.target.value)}
                icon={<Key className="w-4 h-4 text-text/50" />}
                required
              />
              
              <Input 
                label="Database (optional)" 
                value={formData.database || ""} 
                onChange={(e) => handleChange("database", e.target.value)}
                icon={<Database className="w-4 h-4 text-text/50" />}
                placeholder="master"
                className="col-span-2"
              />
            </div>
            
            <div className="mt-6 pt-4 border-t border-border/50">
              <h4 className="text-sm font-medium mb-3 flex items-center">
                <Shield className="w-4 h-4 mr-2" /> Security Options
              </h4>
              <div className="space-y-2">
                <label className="flex items-center text-sm cursor-pointer hover:text-text/80">
                  <input 
                    type="checkbox" 
                    className="mr-2 rounded border-border bg-surface text-accent focus:ring-accent"
                    checked={formData.encrypt || false}
                    onChange={(e) => handleOptionChange("encrypt", e.target.checked)}
                  />
                  Encrypt connection (Required for Azure)
                </label>
                <label className="flex items-center text-sm cursor-pointer hover:text-text/80">
                  <input 
                    type="checkbox" 
                    className="mr-2 rounded border-border bg-surface text-accent focus:ring-accent"
                    checked={formData.trustServerCertificate || false}
                    onChange={(e) => handleOptionChange("trustServerCertificate", e.target.checked)}
                  />
                  Trust server certificate (For local dev)
                </label>
              </div>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded-md text-sm border flex items-start ${
                testResult.success 
                  ? "bg-success/10 border-success/20 text-success-foreground" 
                  : "bg-error/10 border-error/20 text-error-foreground"
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />}
                <span className="whitespace-pre-wrap">{testResult.message}</span>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-border/50 flex justify-between items-center mt-auto">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSave} disabled={!(name || "").trim()}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
              {selectedConnectionId && (
                <Button variant="danger" onClick={() => {/* TODO: Delete */}}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleTest} loading={isTesting} disabled={isConnecting}>
                Test Connection
              </Button>
              <Button variant="primary" onClick={handleConnect} loading={isConnecting} disabled={isTesting} icon={<Play className="w-4 h-4" />}>
                Connect
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
