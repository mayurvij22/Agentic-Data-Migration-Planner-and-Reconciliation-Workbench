import React, { useState, useEffect } from 'react';
import {
  Play, RotateCcw, GitCompare, Loader, CheckCircle, XCircle,
  AlertTriangle, Eye, BarChart3, RefreshCw, ArrowRight
} from 'lucide-react';
import api from '../services/api';

export default function ExecutionPanel({ toast, currentPlan, executions, onExecutionsUpdate }) {
  const [loading, setLoading] = useState({});
  const [selectedExec, setSelectedExec] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [activeView, setActiveView] = useState('counts'); // counts | records | quarantine

  // Load executions on mount
  useEffect(() => {
    refreshExecutions();
  }, []);

  const refreshExecutions = async () => {
    try {
      const data = await api.getExecutions();
      onExecutionsUpdate(data.executions || []);
    } catch (e) { /* silent */ }
  };

  const handleDryRun = async () => {
    if (!currentPlan?.id) return toast('No plan to execute', 'warning');
    setLoading(p => ({ ...p, dryRun: true }));
    try {
      const result = await api.dryRun(currentPlan.id);
      await refreshExecutions();
      setSelectedExec(result.execution);
      toast(`Dry run complete: ${result.execution.counts.accepted} accepted, ${result.execution.counts.rejected} rejected`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, dryRun: false }));
    }
  };

  const handleExecute = async () => {
    if (!currentPlan?.id) return toast('No plan to execute', 'warning');
    setLoading(p => ({ ...p, execute: true }));
    try {
      const result = await api.executeMigration(currentPlan.id);
      await refreshExecutions();
      setSelectedExec(result.execution);
      toast(`Migration executed: ${result.execution.counts.accepted} records migrated`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, execute: false }));
    }
  };

  const handleRollback = async (execId) => {
    setLoading(p => ({ ...p, [`rollback_${execId}`]: true }));
    try {
      await api.rollback(execId);
      await refreshExecutions();
      setSelectedExec(null);
      setReconciliation(null);
      toast('Migration rolled back successfully', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, [`rollback_${execId}`]: false }));
    }
  };

  const handleReconcile = async (execId) => {
    setLoading(p => ({ ...p, reconcile: true }));
    try {
      const result = await api.reconcile(execId);
      setReconciliation(result.report);
      toast(result.report.isBalanced ? 'Reconciliation passed — counts balanced' : 'Reconciliation warning — count mismatch', result.report.isBalanced ? 'success' : 'warning');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, reconcile: false }));
    }
  };

  const handleCompare = async (execId) => {
    setLoading(p => ({ ...p, compare: true }));
    try {
      const result = await api.compare(execId);
      setComparison(result.comparison);
      setActiveView('records');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, compare: false }));
    }
  };

  const viewExecution = async (exec) => {
    setLoading(p => ({ ...p, viewExec: true }));
    try {
      const result = await api.getExecution(exec.id);
      setSelectedExec(result.execution);
      setReconciliation(null);
      setComparison(null);
      setActiveView('counts');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, viewExec: false }));
    }
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} style={{ color: 'var(--success)' }} />;
      case 'rolled_back': return <RotateCcw size={14} style={{ color: 'var(--warning)' }} />;
      case 'failed': return <XCircle size={14} style={{ color: 'var(--error)' }} />;
      default: return <Loader size={14} className="animate-pulse" />;
    }
  };

  return (
    <div>
      <div className="panel-header">
        <h1><Play size={28} /> <span className="gradient-text">Execute & Reconcile</span></h1>
        <p>Run dry runs, execute approved migrations, compare source vs target, and rollback if needed.</p>
      </div>

      {/* ── Actions ── */}
      <div className="section">
        <div className="btn-group">
          <button className="btn btn-lg" onClick={handleDryRun} disabled={loading.dryRun || !currentPlan} id="btn-dry-run">
            {loading.dryRun ? <Loader size={18} className="animate-pulse" /> : <Eye size={18} />}
            Dry Run
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleExecute}
            disabled={loading.execute || !currentPlan || currentPlan?.status !== 'approved'} id="btn-execute">
            {loading.execute ? <Loader size={18} className="animate-pulse" /> : <Play size={18} />}
            Execute Migration
          </button>
          <button className="btn btn-sm" onClick={refreshExecutions}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {currentPlan && currentPlan.status !== 'approved' && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
              Plan must be approved before execution. Dry run is available for any plan.
            </span>
          </div>
        )}
      </div>

      {/* ── Executions List ── */}
      {executions.length > 0 && (
        <div className="section">
          <div className="section-title"><BarChart3 size={18} /> Executions ({executions.length})</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Accepted</th>
                  <th>Rejected</th>
                  <th>Quarantined</th>
                  <th>Dupes Skipped</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {executions.slice().reverse().map(exec => (
                  <tr key={exec.id} style={{ cursor: 'pointer', background: selectedExec?.id === exec.id ? 'var(--violet-dim)' : undefined }}
                    onClick={() => viewExecution(exec)}>
                    <td><code style={{ fontSize: '0.75rem' }}>{exec.id}</code></td>
                    <td><span className={`badge ${exec.type === 'dry_run' ? 'badge-info' : 'badge-violet'}`}>{exec.type}</span></td>
                    <td>{statusIcon(exec.status)} <span style={{ fontSize: '0.82rem', marginLeft: 4 }}>{exec.status}</span></td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{exec.counts?.accepted}</td>
                    <td style={{ color: 'var(--error)', fontWeight: 600 }}>{exec.counts?.rejected || 0}</td>
                    <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{exec.counts?.quarantined || 0}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{exec.counts?.duplicatesSkipped || 0}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {exec.completedAt ? new Date(exec.completedAt).toLocaleTimeString() : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="btn-group">
                        <button className="btn btn-sm" onClick={() => handleReconcile(exec.id)} title="Reconcile">
                          <GitCompare size={12} />
                        </button>
                        <button className="btn btn-sm" onClick={() => handleCompare(exec.id)} title="Compare Records">
                          <Eye size={12} />
                        </button>
                        {exec.type === 'execute' && exec.status === 'completed' && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleRollback(exec.id)}
                            disabled={loading[`rollback_${exec.id}`]} title="Rollback" id={`btn-rollback-${exec.id}`}>
                            {loading[`rollback_${exec.id}`] ? <Loader size={12} className="animate-pulse" /> : <RotateCcw size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Selected Execution Details ── */}
      {selectedExec && (
        <div className="section fade-in">
          <div className="section-title">Execution Details: {selectedExec.id}</div>

          {/* Counts */}
          <div className="stat-grid" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="stat-card"><div className="stat-value">{selectedExec.counts?.source}</div><div className="stat-label">Source</div></div>
            <div className="stat-card" style={{ borderColor: 'var(--info)' }}><div className="stat-value">{selectedExec.counts?.transformed}</div><div className="stat-label">Transformed</div></div>
            <div className="stat-card" style={{ borderColor: 'var(--success)' }}><div className="stat-value">{selectedExec.counts?.accepted}</div><div className="stat-label">Accepted</div></div>
            <div className="stat-card" style={{ borderColor: 'var(--error)' }}><div className="stat-value">{selectedExec.counts?.rejected}</div><div className="stat-label">Rejected</div></div>
            <div className="stat-card" style={{ borderColor: 'var(--warning)' }}><div className="stat-value">{selectedExec.counts?.quarantined}</div><div className="stat-label">Quarantined</div></div>
            <div className="stat-card"><div className="stat-value">{selectedExec.counts?.duplicatesSkipped}</div><div className="stat-label">Dupes Skipped</div></div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
            <button className={`tab ${activeView === 'counts' ? 'active' : ''}`} onClick={() => setActiveView('counts')}>Summary</button>
            <button className={`tab ${activeView === 'records' ? 'active' : ''}`} onClick={() => { setActiveView('records'); if (!comparison) handleCompare(selectedExec.id); }}>Records</button>
            <button className={`tab ${activeView === 'quarantine' ? 'active' : ''}`} onClick={() => setActiveView('quarantine')}>Quarantine</button>
            <button className={`tab ${activeView === 'errors' ? 'active' : ''}`} onClick={() => setActiveView('errors')}>Errors</button>
          </div>

          {/* Summary View */}
          {activeView === 'counts' && (
            <div className="card">
              <div className="json-display" style={{ maxHeight: 300 }}>
                {JSON.stringify({
                  id: selectedExec.id,
                  type: selectedExec.type,
                  status: selectedExec.status,
                  counts: selectedExec.counts,
                  startedAt: selectedExec.startedAt,
                  completedAt: selectedExec.completedAt,
                  rolledBackAt: selectedExec.rolledBackAt
                }, null, 2)}
              </div>
            </div>
          )}

          {/* Records View */}
          {activeView === 'records' && comparison && (
            <div>
              <div className="schema-grid">
                <div className="card">
                  <div className="card-title" style={{ color: 'var(--cyan-light)', marginBottom: 'var(--space-3)' }}>
                    Source Records ({comparison.totalSource})
                  </div>
                  <div className="json-display" style={{ maxHeight: 300, fontSize: '0.72rem' }}>
                    {JSON.stringify(comparison.sourceRecords?.slice(0, 10), null, 2)}
                  </div>
                </div>
                <div className="card">
                  <div className="card-title" style={{ color: 'var(--violet-light)', marginBottom: 'var(--space-3)' }}>
                    Target Records ({comparison.totalTarget})
                  </div>
                  <div className="json-display" style={{ maxHeight: 300, fontSize: '0.72rem' }}>
                    {JSON.stringify(comparison.targetRecords?.slice(0, 10), null, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeView === 'records' && loading.compare && (
            <div className="loading-overlay"><div className="spinner spinner-lg" /><span>Loading records...</span></div>
          )}

          {/* Quarantine View */}
          {activeView === 'quarantine' && (
            <div className="card">
              {selectedExec.quarantinedRecords?.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Record #</th><th>Reason</th><th>Errors</th><th>Source Record</th></tr>
                    </thead>
                    <tbody>
                      {selectedExec.quarantinedRecords.map((q, i) => (
                        <tr key={i}>
                          <td>{q.recordIndex}</td>
                          <td><span className="badge badge-error">{q.reason}</span></td>
                          <td style={{ fontSize: '0.78rem' }}>
                            {q.errors?.map((e, j) => (
                              <div key={j} style={{ color: 'var(--error)' }}>
                                <strong>{e.field || e.sourceField}:</strong> {e.error}
                              </div>
                            ))}
                          </td>
                          <td><code style={{ fontSize: '0.72rem' }}>{JSON.stringify(q.sourceRecord).substring(0, 100)}…</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <CheckCircle size={32} />
                  <h3>No quarantined records</h3>
                </div>
              )}
            </div>
          )}

          {/* Errors View */}
          {activeView === 'errors' && (
            <div className="card">
              {selectedExec.fieldErrors?.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Record #</th><th>Field</th><th>Error</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {selectedExec.fieldErrors.map((e, i) => (
                        <tr key={i}>
                          <td>{e.recordIndex}</td>
                          <td><code>{e.field || e.sourceField || e.targetField}</code></td>
                          <td style={{ color: 'var(--error)', fontSize: '0.82rem' }}>{e.error}</td>
                          <td><code style={{ color: 'var(--warning)' }}>{JSON.stringify(e.value)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                  <CheckCircle size={32} />
                  <h3>No field errors</h3>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Reconciliation Report ── */}
      {reconciliation && (
        <div className="section fade-in">
          <div className="section-title"><GitCompare size={18} /> Reconciliation Report</div>
          <div className="card" style={{ borderColor: reconciliation.isBalanced ? 'var(--success)' : 'var(--error)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {reconciliation.isBalanced ? (
                <><CheckCircle size={20} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Counts Balanced</span></>
              ) : (
                <><XCircle size={20} style={{ color: 'var(--error)' }} /><span style={{ color: 'var(--error)', fontWeight: 700 }}>✗ Count Mismatch (diff: {reconciliation.counts.difference})</span></>
              )}
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{reconciliation.counts.source}</div><div className="stat-label">Source</div></div>
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowRight size={20} style={{ color: 'var(--violet-light)' }} /></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{reconciliation.counts.target}</div><div className="stat-label">Target</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>{reconciliation.counts.quarantined}</div><div className="stat-label">Quarantined</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-muted)' }}>{reconciliation.counts.duplicatesSkipped}</div><div className="stat-label">Dupes</div></div>
            </div>

            {reconciliation.fieldErrorSummary?.length > 0 && (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)', fontSize: '0.85rem' }}>Error Summary:</div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Field</th><th>Error</th><th>Count</th><th>Sample Values</th></tr></thead>
                    <tbody>
                      {reconciliation.fieldErrorSummary.map((e, i) => (
                        <tr key={i}>
                          <td><code>{e.field}</code></td>
                          <td style={{ fontSize: '0.8rem' }}>{e.error}</td>
                          <td style={{ fontWeight: 700 }}>{e.count}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.sampleValues?.map(v => JSON.stringify(v)).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {executions.length === 0 && !selectedExec && (
        <div className="empty-state" style={{ marginTop: 'var(--space-6)' }}>
          <Play size={48} />
          <h3>No Executions Yet</h3>
          <p>Run a dry run to preview migration results, or execute an approved plan to migrate records.</p>
        </div>
      )}
    </div>
  );
}
