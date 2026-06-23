import { create } from 'zustand';
import {
  ConnectionConfig,
  SavedConnection,
  DatabaseInfo,
  TableInfo,
  ColumnInfo,
  ProcedureInfo,
  ServerInfo,
  QueryResult,
  QueryMessage,
  HistoryEntry,
  AIMessage,
  AIConfig,
} from '@/lib/api';
import * as api from '@/lib/api';

// ===== Types =====

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  results: QueryResult | null;
  isExecuting: boolean;
  isDirty: boolean;
  database: string | null;
  fileHandle?: any;
}

export interface TreeNode {
  id: string;
  label: string;
  type: 'server' | 'database' | 'folder' | 'table' | 'view' | 'procedure' | 'column';
  children?: TreeNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
  metadata?: Record<string, unknown>;
}

export type Theme = 'dark' | 'light';

export interface AppState {
  // Connection state
  connections: SavedConnection[];
  activeConnectionId: string | null;
  activeProfileId: string | null;
  serverInfo: ServerInfo | null;
  showConnectionDialog: boolean;

  // Database state
  databases: DatabaseInfo[];
  selectedDatabase: string | null;
  explorerData: TreeNode[];

  // Editor state
  tabs: QueryTab[];
  activeTabId: string;

  // UI state
  sidebarWidth: number;
  resultsPanelHeight: number;
  theme: Theme;
  showAIPanel: boolean;
  showHistoryPanel: boolean;
  isSidebarCollapsed: boolean;

  // History state
  history: HistoryEntry[];

  // AI state
  aiMessages: AIMessage[];
  aiConfig: AIConfig;
  isAIProcessing: boolean;

  // Actions - Connection
  setShowConnectionDialog: (show: boolean) => void;
  addSavedConnection: (conn: SavedConnection) => void;
  removeSavedConnection: (id: string) => void;
  connectToServer: (config: ConnectionConfig) => Promise<void>;
  disconnectFromServer: () => Promise<void>;

  // Actions - Database
  fetchDatabases: () => Promise<void>;
  setSelectedDatabase: (db: string | null) => void;
  fetchTablesForDatabase: (db: string) => Promise<void>;
  fetchColumnsForTable: (db: string, schema: string, table: string) => Promise<ColumnInfo[]>;
  fetchProceduresForDatabase: (db: string) => Promise<ProcedureInfo[]>;
  toggleTreeNode: (nodeId: string) => void;
  setExplorerNodeLoading: (nodeId: string, loading: boolean) => void;
  setExplorerNodeChildren: (nodeId: string, children: TreeNode[]) => void;

  // Actions - Tabs
  addTab: (sql?: string, title?: string) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSQL: (tabId: string, sql: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  setTabDatabase: (tabId: string, database: string) => void;
  setTabFileHandle: (tabId: string, fileHandle: any) => void;
  saveTab: (tabId: string) => Promise<void>;
  openFile: () => Promise<void>;

  // Editor Interaction
  getEditorSelection?: () => string | undefined;

  // Actions - Query
  executeQuery: (tabId: string, selectedText?: string) => Promise<void>;
  cancelQuery: (tabId: string) => void;

  // Actions - UI
  setShowConnectionDialog: (show: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setResultsPanelHeight: (height: number) => void;
  setTheme: (theme: Theme) => void;
  toggleAIPanel: () => void;
  toggleHistoryPanel: () => void;
  toggleSidebar: () => void;

  // Actions - History
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;

  // Actions - AI
  sendAIMessage: (content: string) => Promise<void>;
  explainQuery: (sql: string) => Promise<void>;
  optimizeQuery: (sql: string) => Promise<void>;
  setAIConfig: (config: Partial<AIConfig>) => void;
  clearAIMessages: () => void;

  // Actions - Export
  exportResults: (tabId: string, format: 'csv' | 'json') => void;
  formatCurrentSQL: () => Promise<void>;
}

// ===== Helpers =====

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** 
 * Attempt to silently reconnect using the saved connection profile.
 * Returns true if reconnection succeeded, false otherwise.
 */
let _isReconnecting = false;
async function silentReconnect(get: () => AppState, set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void): Promise<boolean> {
  if (_isReconnecting) return false;
  _isReconnecting = true;
  
  try {
    const { activeProfileId, connections } = get();
    const savedProfile = connections.find((c) => c.id === activeProfileId);
    if (!savedProfile) {
      // No saved profile to reconnect with
      set({ activeConnectionId: null, showConnectionDialog: true });
      return false;
    }

    console.log('[UniSQL] Attempting silent reconnection...');
    const result = await api.connect(savedProfile);
    
    set({
      activeConnectionId: result.connectionId,
      serverInfo: result.serverInfo,
      showConnectionDialog: false,
    });
    
    console.log('[UniSQL] Silent reconnection successful');
    return true;
  } catch (err) {
    console.error('[UniSQL] Silent reconnection failed:', err);
    set({ activeConnectionId: null, showConnectionDialog: true });
    return false;
  } finally {
    _isReconnecting = false;
  }
}

function createDefaultTab(): QueryTab {
  return {
    id: generateId(),
    title: 'Query 1',
    sql: '',
    results: null,
    isExecuting: false,
    isDirty: false,
    database: null,
  };
}

function getNextTabNumber(tabs: QueryTab[]): number {
  const nums = tabs
    .map((t) => {
      const match = t.title.match(/^Query (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  return nums.length === 0 ? 1 : Math.max(...nums) + 1;
}

// ===== Store =====

const defaultTab = createDefaultTab();

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  connections: [],
  activeConnectionId: null,
  activeProfileId: null,
  serverInfo: null,
  showConnectionDialog: true,

  databases: [],
  selectedDatabase: null,
  explorerData: [],

  tabs: [defaultTab],
  activeTabId: defaultTab.id,

  sidebarWidth: 280,
  resultsPanelHeight: 250,
  theme: 'dark',
  showAIPanel: false,
  showHistoryPanel: false,
  isSidebarCollapsed: false,

  history: [],

  aiMessages: [],
  aiConfig: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: '',
    baseUrl: '',
  },
  isAIProcessing: false,

  // ===== Connection Actions =====

  setShowConnectionDialog: (show) => set({ showConnectionDialog: show }),

  addSavedConnection: (conn) =>
    set((state) => {
      const connections = [...state.connections.filter((c) => c.id !== conn.id), conn];
      try {
        localStorage.setItem('unisql-connections', JSON.stringify(connections));
      } catch {}
      return { connections };
    }),

  removeSavedConnection: (id) =>
    set((state) => {
      const connections = state.connections.filter((c) => c.id !== id);
      try {
        localStorage.setItem('unisql-connections', JSON.stringify(connections));
      } catch {}
      return { connections };
    }),

  connectToServer: async (config) => {
    try {
      const result = await api.connect(config);
      const savedConn: SavedConnection = {
        ...config,
        id: config.id || generateId(),
        lastConnected: new Date().toISOString(),
      };

      set((state) => {
        const connections = [
          ...state.connections.filter((c) => c.id !== savedConn.id),
          savedConn,
        ];
        try {
          localStorage.setItem('unisql-connections', JSON.stringify(connections));
        } catch {}
        return {
          activeConnectionId: result.connectionId,
          activeProfileId: savedConn.id,
          serverInfo: result.serverInfo,
          connections,
          showConnectionDialog: false,
          databases: [],
          selectedDatabase: config.database || null,
          explorerData: [],
        };
      });

      await get().fetchDatabases();
    } catch (error) {
      throw error;
    }
  },

  disconnectFromServer: async () => {
    const { activeConnectionId } = get();
    if (activeConnectionId) {
      try {
        await api.disconnect(activeConnectionId);
      } catch {}
    }
    set({
      activeConnectionId: null,
      serverInfo: null,
      databases: [],
      selectedDatabase: null,
      explorerData: [],
      showConnectionDialog: true,
    });
  },

  // ===== Database Actions =====

  fetchDatabases: async () => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;

    try {
      const result = await api.getDatabases(activeConnectionId);
      const databases = result.databases || [];

      const explorerData: TreeNode[] = databases.map((db) => ({
        id: `db-${db.name}`,
        label: db.name,
        type: 'database' as const,
        isExpanded: false,
        isLoading: false,
        metadata: { database: db.name, isSystem: db.isSystem },
        children: [
          {
            id: `db-${db.name}-tables`,
            label: 'Tables',
            type: 'folder' as const,
            isExpanded: false,
            isLoading: false,
            metadata: { database: db.name },
            children: [],
          },
          {
            id: `db-${db.name}-views`,
            label: 'Views',
            type: 'folder' as const,
            isExpanded: false,
            isLoading: false,
            metadata: { database: db.name },
            children: [],
          },
          {
            id: `db-${db.name}-procedures`,
            label: 'Stored Procedures',
            type: 'folder' as const,
            isExpanded: false,
            isLoading: false,
            metadata: { database: db.name },
            children: [],
          },
        ],
      }));

      set({ databases, explorerData });

      const { selectedDatabase } = get();
      if (selectedDatabase) {
        const dbNode = explorerData.find((n) => n.label === selectedDatabase);
        if (dbNode) {
          get().toggleTreeNode(dbNode.id);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch databases:', error);
      if (error?.message?.includes('Connection not found')) {
        const reconnected = await silentReconnect(get, set);
        if (reconnected) {
          return get().fetchDatabases();
        }
      }
    }
  },

  setSelectedDatabase: (db) => {
    set({ selectedDatabase: db });
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, database: db } : tab
      ),
    }));
  },

  fetchTablesForDatabase: async (db) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return;

    try {
      const [tablesResult, viewsResult] = await Promise.all([
        api.getTables(activeConnectionId, db).catch(() => ({ tables: [] })),
        api.getViews(activeConnectionId, db).catch(() => ({ views: [] }))
      ]);
      
      const tables = tablesResult.tables || [];
      const views = viewsResult.views || [];

      const tableNodes: TreeNode[] = tables
        .filter((t) => t.type === 'BASE TABLE' || t.type === 'TABLE')
        .map((t) => ({
          id: `table-${db}-${t.schema}-${t.name}`,
          label: `${t.schema}.${t.name}`,
          type: 'table' as const,
          metadata: { database: db, schema: t.schema, name: t.name, rowCount: t.rowCount },
          children: [],
          isExpanded: false,
          isLoading: false,
        }));

      const viewNodes: TreeNode[] = views
        .map((t) => ({
          id: `view-${db}-${t.schema}-${t.name}`,
          label: `${t.schema}.${t.name}`,
          type: 'view' as const,
          metadata: { database: db, schema: t.schema, name: t.name },
          children: [],
          isExpanded: false,
          isLoading: false,
        }));

      set((state) => ({
        explorerData: state.explorerData.map((node) => {
          if (node.label !== db) return node;
          return {
            ...node,
            children: node.children?.map((folder) => {
              if (folder.label === 'Tables') {
                return { ...folder, children: tableNodes, isLoading: false };
              }
              if (folder.label === 'Views') {
                return { ...folder, children: viewNodes, isLoading: false };
              }
              return folder;
            }),
          };
        }),
      }));
    } catch (error: any) {
      console.error('Failed to fetch tables:', error);
      if (error?.message?.includes('Connection not found')) {
        const reconnected = await silentReconnect(get, set);
        if (reconnected) {
          return get().fetchTablesForDatabase(db);
        }
      }
    }
  },

  fetchColumnsForTable: async (db, schema, table) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return [];

    try {
      const result = await api.getColumns(activeConnectionId, db, schema, table);
      return result.columns || [];
    } catch (error: any) {
      console.error('Failed to fetch columns:', error);
      if (error?.message?.includes('Connection not found')) {
        const reconnected = await silentReconnect(get, set);
        if (reconnected) {
          return get().fetchColumnsForTable(db, schema, table);
        }
      }
      return [];
    }
  },

  fetchProceduresForDatabase: async (db) => {
    const { activeConnectionId } = get();
    if (!activeConnectionId) return [];

    try {
      const result = await api.getProcedures(activeConnectionId, db);
      const procedures = result.procedures || [];

      const procNodes: TreeNode[] = procedures.map((p) => ({
        id: `proc-${db}-${p.schema}-${p.name}`,
        label: `${p.schema}.${p.name}`,
        type: 'procedure' as const,
        metadata: { schema: p.schema, name: p.name },
      }));

      set((state) => ({
        explorerData: state.explorerData.map((node) => {
          if (node.label !== db) return node;
          return {
            ...node,
            children: node.children?.map((folder) => {
              if (folder.label === 'Stored Procedures') {
                return { ...folder, children: procNodes, isLoading: false };
              }
              return folder;
            }),
          };
        }),
      }));

      return procedures;
    } catch (error: any) {
      console.error('Failed to fetch procedures:', error);
      if (error?.message?.includes('Connection not found')) {
        const reconnected = await silentReconnect(get, set);
        if (reconnected) {
          return get().fetchProceduresForDatabase(db);
        }
      }
      return [];
    }
  },

  toggleTreeNode: (nodeId) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });

    set((state) => ({ explorerData: updateNode(state.explorerData) }));
  },

  setExplorerNodeLoading: (nodeId, loading) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, isLoading: loading };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });

    set((state) => ({ explorerData: updateNode(state.explorerData) }));
  },

  setExplorerNodeChildren: (nodeId, children) => {
    const updateNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, children, isLoading: false };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });

    set((state) => ({ explorerData: updateNode(state.explorerData) }));
  },

  // ===== Tab Actions =====

  addTab: (sql, title) => {
    const state = get();
    const num = getNextTabNumber(state.tabs);
    const tab: QueryTab = {
      id: generateId(),
      title: title || `Query ${num}`,
      sql: sql || '',
      results: null,
      isExecuting: false,
      isDirty: false,
      database: state.selectedDatabase,
    };
    set({ tabs: [...state.tabs, tab], activeTabId: tab.id });
  },

  removeTab: (tabId) =>
    set((state) => {
      if (state.tabs.length <= 1) return state;
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const newActiveId =
        state.activeTabId === tabId
          ? newTabs[newTabs.length - 1].id
          : state.activeTabId;
      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabSQL: (tabId, sql) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, sql, isDirty: true } : tab
      ),
    })),

  updateTabTitle: (tabId, title) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, title } : tab
      ),
    })),

  setTabDatabase: (tabId, database) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, database } : tab
      ),
    })),

  setTabFileHandle: (tabId, fileHandle) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, fileHandle } : tab
      ),
    })),

  saveTab: async (tabId) => {
    const state = get();
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab || !tab.sql) return;

    try {
      let fileHandle = tab.fileHandle;
      if (!fileHandle) {
        if ('showSaveFilePicker' in window) {
          fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `${tab.title || 'query'}.sql`,
            types: [{ description: 'SQL File', accept: { 'application/sql': ['.sql'] } }],
          });
          get().setTabFileHandle(tab.id, fileHandle);
          get().updateTabTitle(tab.id, fileHandle.name);
        } else {
          // Fallback to old download logic
          const blob = new Blob([tab.sql], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tab.title || 'query'}.sql`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
      
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(tab.sql);
        await writable.close();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err);
      }
    }
  },

  openFile: async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            { description: 'SQL File', accept: { 'application/sql': ['.sql'] } },
            { description: 'Text File', accept: { 'text/plain': ['.txt'] } }
          ],
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        get().addTab(content, file.name);
        
        // Grab the newly added tab
        const state = get();
        const newTab = state.tabs[state.tabs.length - 1];
        get().setTabFileHandle(newTab.id, fileHandle);
      } else {
        // Fallback to old input method
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sql,.txt';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result as string;
            get().addTab(content, file.name);
          };
          reader.readAsText(file);
        };
        input.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to open file:', err);
      }
    }
  },

  // ===== Query Actions =====

  executeQuery: async (tabId, selectedText) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab || !state.activeConnectionId) return;

    const sqlToExecute = selectedText || tab.sql;
    if (!sqlToExecute.trim()) return;

    const database = tab.database || state.selectedDatabase || 'master';
    if (!database) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                results: {
                  columns: [],
                  rows: [],
                  rowCount: 0,
                  executionTime: 0,
                  messages: [
                    {
                      type: 'error' as const,
                      text: 'No database selected. Please select a database first.',
                      timestamp: new Date().toISOString(),
                    },
                  ],
                },
              }
            : t
        ),
      }));
      return;
    }

    // Set executing state
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isExecuting: true } : t
      ),
    }));

    try {
      const result = await api.executeQuery(
        state.activeConnectionId,
        database,
        sqlToExecute
      );
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, results: result, isExecuting: false }
            : t
        ),
      }));

      // Auto-refresh explorer if DDL statements were executed
      const sqlUpper = sqlToExecute.toUpperCase();
      if (sqlUpper.includes('CREATE DATABASE') || sqlUpper.includes('DROP DATABASE') || sqlUpper.includes('ALTER DATABASE')) {
        await get().fetchDatabases();
      } else if (sqlUpper.includes('CREATE TABLE') || sqlUpper.includes('DROP TABLE') || sqlUpper.includes('ALTER TABLE') || sqlUpper.includes('CREATE VIEW') || sqlUpper.includes('DROP VIEW')) {
        await get().fetchTablesForDatabase(database);
      } else if (sqlUpper.includes('CREATE PROC') || sqlUpper.includes('DROP PROC') || sqlUpper.includes('ALTER PROC')) {
        await get().fetchProceduresForDatabase(database);
      }

    } catch (error: any) {
      // If the user cancelled the query, don't show an error (cancelQuery handles the UI)
      if (error?.name === 'AbortError') return;

      const isConnectionLost = error?.message?.includes('Connection not found');
      
      // Try silent reconnection first
      if (isConnectionLost) {
        const reconnected = await silentReconnect(get, set);
        if (reconnected) {
          // Retry the query after successful reconnection
          return get().executeQuery(tabId, selectedText);
        }
      }
      
      const message: QueryMessage = {
        type: 'error',
        text: isConnectionLost ? 'Connection expired. Please reconnect.' : (error instanceof Error ? error.message : 'Query execution failed'),
        timestamp: new Date().toISOString(),
      };
      
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isExecuting: false,
                results: {
                  columns: [],
                  rows: [],
                  rowCount: 0,
                  executionTime: 0,
                  messages: [message],
                },
              }
            : t
        ),
      }));
    }
  },

  cancelQuery: (tabId) => {
    api.cancelCurrentQuery();
    
    const message: QueryMessage = {
      type: 'warning' as const,
      text: 'Query execution was cancelled by user.',
      timestamp: new Date().toISOString(),
    };
    
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              isExecuting: false,
              results: {
                columns: [],
                rows: [],
                rowCount: 0,
                executionTime: 0,
                messages: [message],
              },
            }
          : t
      ),
    }));
  },

  // ===== UI Actions =====

  setShowConnectionDialog: (show) => set({ showConnectionDialog: show }),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setResultsPanelHeight: (height) => set({ resultsPanelHeight: height }),

  setTheme: (theme) => {
    const applyTheme = () => {
      set({ theme });
      try {
        localStorage.setItem('unisql-theme', theme);
      } catch {}
      document.documentElement.setAttribute('data-theme', theme);
    };

    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(applyTheme);
    } else {
      applyTheme();
    }
  },

  toggleAIPanel: () =>
    set((state) => ({
      showAIPanel: !state.showAIPanel,
      showHistoryPanel: state.showAIPanel ? state.showHistoryPanel : false,
    })),

  toggleHistoryPanel: () =>
    set((state) => ({
      showHistoryPanel: !state.showHistoryPanel,
      showAIPanel: state.showHistoryPanel ? state.showAIPanel : false,
    })),

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  // ===== History Actions =====

  loadHistory: async () => {
    try {
      const result = await api.getHistory();
      set({ history: result.history || [] });
    } catch {
      // Use local fallback
      try {
        const stored = localStorage.getItem('unisql-history');
        if (stored) set({ history: JSON.parse(stored) });
      } catch {}
    }
  },

  clearHistory: async () => {
    try {
      await api.clearHistory();
    } catch {}
    set({ history: [] });
    try {
      localStorage.removeItem('unisql-history');
    } catch {}
  },

  // ===== AI Actions =====

  sendAIMessage: async (content) => {
    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      aiMessages: [...state.aiMessages, userMessage],
      isAILoading: true,
    }));

    try {
      const state = get();
      const result = await api.aiChat(
        [...state.aiMessages],
        undefined,
        state.aiConfig
      );
      const assistantMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, assistantMessage],
        isAILoading: false,
      }));
    } catch (error) {
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get AI response'}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, errorMessage],
        isAILoading: false,
      }));
    }
  },

  explainQuery: async (sql) => {
    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content: `Explain this SQL query:\n\`\`\`sql\n${sql}\n\`\`\``,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      aiMessages: [...state.aiMessages, userMessage],
      isAILoading: true,
      showAIPanel: true,
    }));

    try {
      const result = await api.aiExplainQuery(sql, get().aiConfig);
      const assistantMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: result.explanation,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, assistantMessage],
        isAILoading: false,
      }));
    } catch (error) {
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to explain query'}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, errorMessage],
        isAILoading: false,
      }));
    }
  },

  optimizeQuery: async (sql) => {
    const userMessage: AIMessage = {
      id: generateId(),
      role: 'user',
      content: `Optimize this SQL query:\n\`\`\`sql\n${sql}\n\`\`\``,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      aiMessages: [...state.aiMessages, userMessage],
      isAILoading: true,
      showAIPanel: true,
    }));

    try {
      const result = await api.aiOptimizeQuery(sql, get().aiConfig);
      const assistantMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `**Optimized Query:**\n\`\`\`sql\n${result.optimized}\n\`\`\`\n\n**Explanation:**\n${result.explanation}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, assistantMessage],
        isAILoading: false,
      }));
    } catch (error) {
      const errorMessage: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to optimize query'}`,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        aiMessages: [...s.aiMessages, errorMessage],
        isAILoading: false,
      }));
    }
  },

  setAIConfig: (config) =>
    set((state) => ({
      aiConfig: { ...state.aiConfig, ...config },
    })),

  clearAIMessages: () => set({ aiMessages: [] }),

  // ===== Export Actions =====

  exportResults: (tabId, format) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab?.results) return;

    if (format === 'csv') {
      api.downloadAsCSV(tab.results.columns, tab.results.rows);
    } else {
      api.downloadAsJSON(tab.results.rows);
    }
  },

  formatCurrentSQL: async () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab || !tab.sql.trim()) return;

    try {
      const result = await api.formatSQL(tab.sql);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId ? { ...t, sql: result.formatted } : t
        ),
      }));
    } catch (error) {
      console.error('Failed to format SQL:', error);
    }
  },
}));

// ===== Initialize store from localStorage =====
if (typeof window !== 'undefined') {
  try {
    const savedTheme = localStorage.getItem('unisql-theme') as Theme | null;
    if (savedTheme) {
      useAppStore.getState().setTheme(savedTheme);
    }
  } catch {}

  try {
    const savedConnections = localStorage.getItem('unisql-connections');
    if (savedConnections) {
      useAppStore.setState({ connections: JSON.parse(savedConnections) });
    }
  } catch {}
  try {
    const savedTabsData = localStorage.getItem('unisql-tabs');
    if (savedTabsData) {
      const parsed = JSON.parse(savedTabsData);
      if (parsed.tabs && parsed.tabs.length > 0) {
        useAppStore.setState({ 
          tabs: parsed.tabs.map((t: any) => ({ ...t, isExecuting: false })), 
          activeTabId: parsed.activeTabId || parsed.tabs[0].id 
        });
      }
    }
  } catch {}

  // Subscribe to changes to persist tabs
  useAppStore.subscribe((state, prevState) => {
    if (state.tabs !== prevState.tabs || state.activeTabId !== prevState.activeTabId) {
      const tabsToSave = state.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        sql: t.sql,
        database: t.database,
      }));
      try {
        localStorage.setItem('unisql-tabs', JSON.stringify({ tabs: tabsToSave, activeTabId: state.activeTabId }));
      } catch {}
    }
  });
}
