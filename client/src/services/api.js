/**
 * API Service — centralized HTTP client for the Migration Planner backend.
 */

const API_BASE = '/api';

async function request(method, path, body) {
  const config = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, config);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);

const api = {
  // ── Health ──
  health: () => get('/health'),
  reset: () => post('/reset'),

  // ── Schema ──
  getSchemas: () => get('/schema'),
  setSourceSchema: (schema) => post('/schema/source', schema),
  setTargetSchema: (schema) => post('/schema/target', schema),
  uploadRecords: (records) => post('/schema/source/records', { records }),
  getRecords: (page = 1, limit = 20) => get(`/schema/source/records?page=${page}&limit=${limit}`),

  // ── AI Agent (key comes from the server's GEMINI_API_KEY env variable) ──
  agentStatus: () => get('/agent/status'),
  analyzeSchemas: () => post('/agent/analyze'),
  assessRisks: (mappings) => post('/agent/risks', { mappings }),
  generateQuestions: (mappings) => post('/agent/questions', { mappings }),

  // ── Migration ──
  getTransformations: () => get('/migration/transformations'),
  savePlan: (plan) => post('/migration/plan', plan),
  getPlans: () => get('/migration/plans'),
  getPlan: (id) => get(`/migration/plan/${id}`),
  approvePlan: (id) => put(`/migration/plan/${id}/approve`),
  dryRun: (id) => post(`/migration/plan/${id}/dry-run`),
  executeMigration: (id) => post(`/migration/plan/${id}/execute`),
  getExecutions: () => get('/migration/executions'),
  getExecution: (id) => get(`/migration/execution/${id}`),
  rollback: (id) => post(`/migration/execution/${id}/rollback`),

  // ── Reconciliation ──
  reconcile: (execId) => get(`/reconciliation/${execId}`),
  compare: (execId) => get(`/reconciliation/${execId}/compare`),

  // ── History & Quarantine ──
  getHistory: (limit = 200) => get(`/history?limit=${limit}`),
  getQuarantine: () => get('/quarantine'),
};

export default api;
