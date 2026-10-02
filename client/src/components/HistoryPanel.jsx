import React, { useState, useEffect } from 'react';
import {
  History, RefreshCw, Loader, Clock, AlertTriangle, CheckCircle,
  Database, Brain, Play, RotateCcw, FileText, Shield, Trash2
} from 'lucide-react';
import api from '../services/api';

const ACTION_ICONS = {
  SCHEMA_SET: Database,
  RECORDS_LOADED: Database,
  PLAN_SAVED: FileText,
  PLAN_APPROVED: CheckCircle,
  AI_ANALYSIS: Brain,
  AI_RISK_ASSESSMENT: Shield,
  AI_QUESTIONS: Brain,
  AI_ERROR: AlertTriangle,
  DRY_RUN_COMPLETED: Play,
  MIGRATION_EXECUTED: Play,
  MIGRATION_ROLLED_BACK: RotateCcw,
  RECONCILIATION_RUN: Shield,
  STORE_RESET: Trash2,
};

const ACTION_COLORS = {
  SCHEMA_SET: 'var(--cyan)',
  RECORDS_LOADED: 'var(--cyan)',
  PLAN_SAVED: 'var(--violet)',
  PLAN_APPROVED: 'var(--success)',
  AI_ANALYSIS: 'var(--violet-light)',
  AI_RISK_ASSESSMENT: 'var(--warning)',
  AI_QUESTIONS: 'var(--info)',
  AI_ERROR: 'var(--error)',
  DRY_RUN_COMPLETED: 'var(--info)',
  MIGRATION_EXECUTED: 'var(--success)',
  MIGRATION_ROLLED_BACK: 'var(--warning)',
  RECONCILIATION_RUN: 'var(--success)',
  STORE_RESET: 'var(--error)',
};

export default function HistoryPanel({ toast }) {
  const [history, setHistory] = useState([]);
  const [quarantine, setQuarantine] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [histData, qData] = await Promise.all([
        api.getHistory(200),
        api.getQuarantine()
      ]);
      setHistory(histData.history || []);
      setQuarantine(qData.records || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const handleReset = async () => {
    if (!confirm('Reset the entire in-memory store? This will clear all schemas, records, plans, and executions.')) return;
    try {
      await api.reset();
      toast('Store reset — all data cleared', 'warning');
      loadHistory();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString();
  };

  return (
    <div>
      <div className="panel-header">
        <h1><History size={28} /> <span className="gradient-text">History & Audit</span></h1>
        <p>Full audit trail of all actions: schema changes, AI analysis, plan saves, approvals, executions, rollbacks.</p>
      </div>

      {/* ── Actions ── */}
      <div className="section">
        <div className="btn-group">
          <button className="btn" onClick={loadHistory} disabled={loading} id="btn-refresh-history">
            {loading ? <Loader size={16} className="animate-pulse" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button className="btn btn-danger" onClick={handleReset} id="btn-reset-store">
            <Trash2 size={16} /> Reset Store
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          Audit Log ({history.length})
        </button>
        <button className={`tab ${activeTab === 'quarantine' ? 'active' : ''}`} onClick={() => setActiveTab('quarantine')}>
          Quarantine ({quarantine.length})
        </button>
      </div>

      {/* ── Audit Log ── */}
      {activeTab === 'audit' && (
        <div className="section">
          {loading ? (
            <div className="loading-overlay"><div className="spinner spinner-lg" /><span>Loading history...</span></div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <Clock size={48} />
              <h3>No History Yet</h3>
              <p>Actions will appear here as you use the application.</p>
            </div>
          ) : (
            <div className="timeline">
              {history.map((entry, i) => {
                const Icon = ACTION_ICONS[entry.action] || Clock;
                const color = ACTION_COLORS[entry.action] || 'var(--text-muted)';
                return (
                  <div key={entry.id || i} className={`timeline-item ${
                    entry.action.includes('ERROR') ? 'error' :
                    entry.action.includes('ROLLBACK') ? 'warning' :
                    entry.action.includes('APPROVED') || entry.action.includes('EXECUTED') ? 'success' : ''
                  }`}>
                    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 4 }}>
                        <Icon size={16} style={{ color, flexShrink: 0 }} />
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{entry.action}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', paddingLeft: 28 }}>
                        {entry.description}
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <div style={{ paddingLeft: 28, marginTop: 4 }}>
                          <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {JSON.stringify(entry.metadata)}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quarantine ── */}
      {activeTab === 'quarantine' && (
        <div className="section">
          {quarantine.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={48} />
              <h3>No Quarantined Records</h3>
              <p>Records that fail validation or transformation are quarantined here with field-level error evidence.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Record #</th>
                    <th>Reason</th>
                    <th>Errors</th>
                    <th>Quarantined At</th>
                  </tr>
                </thead>
                <tbody>
                  {quarantine.map((q, i) => (
                    <tr key={i}>
                      <td><code style={{ fontSize: '0.75rem' }}>{q.executionId}</code></td>
                      <td>{q.recordIndex}</td>
                      <td><span className="badge badge-error">{q.reason}</span></td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {q.errors?.map((e, j) => (
                          <div key={j} style={{ color: 'var(--error)', marginBottom: 2 }}>
                            <strong>{e.field || e.sourceField || e.targetField}:</strong> {e.error}
                            {e.value !== undefined && <span style={{ color: 'var(--text-muted)' }}> (value: {JSON.stringify(e.value)})</span>}
                          </div>
                        ))}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(q.quarantinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
