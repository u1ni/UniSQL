"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import { TreeView, TreeNode } from "./ui/TreeView";
import { Database, Table, Eye, Code, Search, RefreshCw, Layers, Columns } from "lucide-react";
import { ContextMenu, ContextMenuItem } from "./ui/ContextMenu";

export function Sidebar() {
  const { 
    activeConnectionId, 
    activeProfileId,
    connections, 
    databases, 
    explorerData,
    fetchDatabases,
    fetchTablesForDatabase,
    fetchColumnsForTable,
    fetchProceduresForDatabase,
    setExplorerNodeLoading,
    setExplorerNodeChildren,
    selectedDatabase,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: TreeNode } | null>(null);

  const activeConnection = connections.find(c => c.id === activeProfileId);

  useEffect(() => {
    if (activeConnectionId && databases.length === 0) {
      fetchDatabases();
    }
  }, [activeConnectionId, databases.length, fetchDatabases]);

  const addIcons = (nodes: any[]): TreeNode[] => {
    return nodes.map(node => {
      let icon = undefined;
      if (node.type === 'database') icon = Database;
      else if (node.type === 'folder') icon = Layers;
      else if (node.type === 'table') icon = Table;
      else if (node.type === 'view') icon = Eye;
      else if (node.type === 'procedure') icon = Code;
      else if (node.type === 'column') icon = Columns;
      
      return {
        ...node,
        icon,
        data: node.metadata, // Map metadata to data for ContextMenu
        children: node.children ? addIcons(node.children) : undefined
      };
    });
  };

  const buildTree = (): TreeNode[] => {
    if (!activeConnection) return [];

    const serverNode: TreeNode = {
      id: "server",
      label: activeConnection.server,
      type: "server",
      icon: ServerIcon as any,
      children: addIcons(explorerData)
    };

    return [serverNode];
  };

  const handleExpand = async (node: TreeNode) => {
    if (node.type === "database" && node.data?.database) {
      useAppStore.setState({ selectedDatabase: node.data.database });
      const tablesFolder = node.children?.find(c => c.label === "Tables");
      if (!tablesFolder?.children || tablesFolder.children.length === 0) {
        setExplorerNodeLoading(node.id, true);
        await fetchTablesForDatabase(node.data.database);
      }
    } else if (node.type === "folder" && (node.label === "Tables" || node.label === "Views") && node.data?.database) {
      if (!node.children || node.children.length === 0) {
        setExplorerNodeLoading(node.id, true);
        await fetchTablesForDatabase(node.data.database);
      }
    } else if (node.type === "folder" && node.label === "Stored Procedures" && node.data?.database) {
      if (!node.children || node.children.length === 0) {
        setExplorerNodeLoading(node.id, true);
        await fetchProceduresForDatabase(node.data.database);
      }
    } else if (node.type === "table" && node.data) {
      const { database, schema, name } = node.data;
      if (!node.children || node.children.length === 0) {
        setExplorerNodeLoading(node.id, true);
        const columns = await fetchColumnsForTable(database, schema, name);
        const colNodes: TreeNode[] = columns.map((c: any) => ({
          id: `col-${database}-${schema}-${name}-${c.name}`,
          label: `${c.name} (${c.type}${c.length ? `(${c.length})` : ''}) ${c.nullable ? 'null' : 'not null'}`,
          type: 'column' as any,
          isExpanded: false,
          isLoading: false
        }));
        setExplorerNodeChildren(node.id, colNodes);
      }
    }
  };

  const handleSelect = (node: TreeNode) => {
    if (node.type === "database" && node.data) {
      useAppStore.setState({ selectedDatabase: node.data.database });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  // Generate context menu items based on node type
  const getContextMenuItems = (node: TreeNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    
    if (node.type === "table" && node.data) {
      const { database, schema, name } = node.data;
      const tableName = name || node.data.table;
      const selectSql = `SELECT TOP 1000 * \nFROM [${database}].[${schema}].[${tableName}]`;
      
      items.push({
        id: "select-1000",
        label: "Select Top 1000 Rows",
        onClick: () => {
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(selectSql);
        }
      });
      items.push({ divider: true, id: "div1", label: "", onClick: ()=>{} });

      // Script as CREATE
      items.push({
        id: "script-create",
        label: "Script as CREATE",
        onClick: () => {
          const cols = node.children?.map(c => {
            const parts = c.label.split(' ');
            const colName = parts[0];
            const rest = parts.slice(1).join(' ').replace(/[()]/g, '');
            return `    [${colName}] ${rest}`;
          }) || [`    -- Expand the table first to load columns`];
          const createSql = `CREATE TABLE [${database}].[${schema}].[${tableName}] (\n${cols.join(',\n')}\n);`;
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(createSql);
        }
      });

      // Script as INSERT
      items.push({
        id: "script-insert",
        label: "Script as INSERT",
        onClick: () => {
          const colNames = node.children?.map(c => c.label.split(' ')[0]) || ['column1'];
          const placeholders = colNames.map(() => '<value>');
          const insertSql = `INSERT INTO [${database}].[${schema}].[${tableName}] (${colNames.map(c => `[${c}]`).join(', ')})\nVALUES (${placeholders.join(', ')});`;
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(insertSql);
        }
      });

      // Script as UPDATE
      items.push({
        id: "script-update",
        label: "Script as UPDATE",
        onClick: () => {
          const colNames = node.children?.map(c => c.label.split(' ')[0]) || ['column1'];
          const setClauses = colNames.map(c => `    [${c}] = <value>`).join(',\n');
          const updateSql = `UPDATE [${database}].[${schema}].[${tableName}]\nSET\n${setClauses}\nWHERE <condition>;`;
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(updateSql);
        }
      });

      // Script as DELETE
      items.push({
        id: "script-delete",
        label: "Script as DELETE",
        onClick: () => {
          const deleteSql = `DELETE FROM [${database}].[${schema}].[${tableName}]\nWHERE <condition>;`;
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(deleteSql);
        }
      });
    }

    if (node.type === "view" && node.data) {
      const { database, schema, name } = node.data;
      const selectSql = `SELECT TOP 1000 * \nFROM [${database}].[${schema}].[${name}]`;
      items.push({
        id: "select-1000-view",
        label: "Select Top 1000 Rows",
        onClick: () => {
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(selectSql);
        }
      });
    }

    if (node.type === "procedure" && node.data) {
      const { database, schema, name } = node.data;
      const execSql = `EXEC [${database}].[${schema}].[${name}]`;
      items.push({
        id: "exec-proc",
        label: "Execute Procedure",
        onClick: () => {
          useAppStore.setState({ selectedDatabase: database });
          useAppStore.getState().addTab(execSql);
        }
      });
    }

    if (node.type === "database" && node.data) {
      items.push({
        id: "new-query",
        label: "New Query",
        onClick: () => {
          useAppStore.setState({ selectedDatabase: node.data.database });
          useAppStore.getState().addTab();
        }
      });
      items.push({
        id: "refresh",
        label: "Refresh",
        onClick: () => fetchTablesForDatabase(node.data.database)
      });
    }

    if (items.length === 0) {
      items.push({ id: "refresh-all", label: "Refresh", onClick: () => fetchDatabases() });
    }

    return items;
  };

  if (!activeConnectionId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <Database className="w-12 h-12 text-border mb-4" />
        <h3 className="text-text font-medium mb-2">Object Explorer</h3>
        <p className="text-text/50 text-sm mb-4">Connect to a server to view databases</p>
        <button 
          onClick={() => useAppStore.setState({ showConnectionDialog: true })}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-sm transition-colors"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-border/50 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-text/40" />
          <input 
            type="text" 
            placeholder="Search objects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-md pl-10 pr-4 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
          />
          <button 
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-text/50 hover:text-accent hover:bg-accent/10 rounded transition-colors z-10"
            onClick={() => {
              useAppStore.setState({ explorerData: [] });
              fetchDatabases();
            }}
            title="Refresh All"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        <TreeView 
          nodes={buildTree()} 
          onExpand={handleExpand}
          onSelect={handleSelect}
          selectedId={selectedDatabase ? `db-${selectedDatabase}` : undefined}
          onContextMenu={handleContextMenu}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
  );
}
