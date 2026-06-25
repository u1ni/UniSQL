// ===== Types for UniSQL Application =====

export interface ConnectionConfig {
  id?: string;
  name: string;
  server: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

export interface SavedConnection extends ConnectionConfig {
  id: string;
  lastConnected?: string;
}

export interface DatabaseInfo {
  name: string;
  isSystem: boolean;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: 'TABLE' | 'VIEW';
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  maxLength: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
}

export interface ProcedureInfo {
  name: string;
  schema: string;
  type: string;
}

export interface ResultSetColumn {
  name: string;
  type: string;
  nullable?: boolean;
  length?: number;
}

export interface ResultSet {
  index: number;
  columns: ResultSetColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryResult {
  columns: ResultSetColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  messages: QueryMessage[];
  resultSets?: ResultSet[];
  rowsAffected?: number[];
}

export interface QueryMessage {
  type: 'info' | 'error' | 'warning' | 'success';
  text: string;
  timestamp: string;
}

export interface ServerInfo {
  version: string;
  name: string;
  edition?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIConfig {
  provider: 'openai' | 'ollama' | 'anthropic' | 'gemini';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// ===== API Client Functions =====

const API_BASE = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : 'http://127.0.0.1:3001/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Request failed with status ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.error || errorJson.message || message;
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }
      } catch {
        if (errorBody) message = errorBody;
      }
      throw new ApiError(typeof message === 'string' ? message : String(message), response.status);
    }
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// ===== Connection API =====

export async function testConnection(
  config: ConnectionConfig
): Promise<{ success: boolean; message: string; serverInfo?: ServerInfo }> {
  return request('/connections/test', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function connect(
  config: ConnectionConfig
): Promise<{ connectionId: string; serverInfo: ServerInfo }> {
  return request('/connections/connect', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function disconnect(connectionId: string): Promise<void> {
  return request('/connections/disconnect', {
    method: 'POST',
    body: JSON.stringify({ connectionId }),
  });
}

// ===== Database API =====

export async function getDatabases(
  connectionId: string
): Promise<{ databases: DatabaseInfo[] }> {
  return request(`/databases`, {
    headers: { 'x-connection-id': connectionId }
  });
}

export async function getTables(connectionId: string, database: string): Promise<{ tables: any[] }> {
  return request(`/databases/${database}/tables`, {
    headers: { 'x-connection-id': connectionId }
  });
}

export async function getViews(connectionId: string, database: string): Promise<{ views: any[] }> {
  return request(`/databases/${database}/views`, {
    headers: { 'x-connection-id': connectionId }
  });
}

export async function getColumns(
  connectionId: string,
  database: string,
  schema: string,
  table: string
): Promise<{ columns: ColumnInfo[] }> {
  return request(
    `/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/columns`, {
    headers: { 'x-connection-id': connectionId }
  });
}

export async function getProcedures(
  connectionId: string,
  database: string
): Promise<{ procedures: ProcedureInfo[] }> {
  return request(
    `/databases/${encodeURIComponent(database)}/procedures`, {
    headers: { 'x-connection-id': connectionId }
  });
}

// ===== Query API =====

// Global abort controller for the currently executing query
let _currentQueryAbort: AbortController | null = null;

export function cancelCurrentQuery() {
  if (_currentQueryAbort) {
    _currentQueryAbort.abort();
    _currentQueryAbort = null;
  }
}

export async function executeQuery(
  connectionId: string,
  database: string,
  sql: string
): Promise<QueryResult> {
  // Cancel any previous in-flight query
  cancelCurrentQuery();
  
  const abortController = new AbortController();
  _currentQueryAbort = abortController;
  
  try {
    const result = await request<QueryResult>('/query/execute', {
      method: 'POST',
      body: JSON.stringify({ connectionId, database, sql }),
      signal: abortController.signal,
    });
    return result;
  } finally {
    if (_currentQueryAbort === abortController) {
      _currentQueryAbort = null;
    }
  }
}

export async function formatSQL(sql: string): Promise<{ formatted: string }> {
  return request('/query/format', {
    method: 'POST',
    body: JSON.stringify({ sql }),
  });
}

// ===== History API =====

export interface HistoryEntry {
  id: string;
  sql: string;
  database: string;
  server: string;
  executionTime: number;
  rowCount: number;
  status: 'success' | 'error';
  timestamp: string;
  error?: string;
}

export async function getHistory(): Promise<{ history: HistoryEntry[] }> {
  return request('/history');
}

export async function recordHistory(entry: Partial<HistoryEntry>): Promise<void> {
  return request('/history', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function clearHistory(): Promise<void> {
  return request('/history', { method: 'DELETE' });
}

// ===== AI API =====

export async function aiExplainQuery(
  sql: string,
  config?: AIConfig
): Promise<{ explanation: string }> {
  return request('/ai/explain', {
    method: 'POST',
    body: JSON.stringify({ sql, config }),
  });
}

export async function aiOptimizeQuery(
  sql: string,
  config?: AIConfig
): Promise<{ optimized: string; explanation: string }> {
  return request('/ai/optimize', {
    method: 'POST',
    body: JSON.stringify({ sql, config }),
  });
}

export async function aiChat(
  messages: AIMessage[],
  sql?: string,
  config?: AIConfig
): Promise<{ reply: string }> {
  return request('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, sql, config }),
  });
}

// ===== Export API =====

export function downloadAsCSV(columns: string[], rows: Record<string, unknown>[]): void {
  const header = columns.join(',');
  const csvRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );
  const csv = [header, ...csvRows].join('\n');
  downloadBlob(csv, 'query-results.csv', 'text/csv');
}

export function downloadAsJSON(rows: Record<string, unknown>[]): void {
  const json = JSON.stringify(rows, null, 2);
  downloadBlob(json, 'query-results.json', 'application/json');
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
