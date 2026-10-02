import React, { useState, useEffect } from 'react';
import {
  FileText, ArrowRight, CheckCircle, Loader, Save, ThumbsUp,
  AlertTriangle, Edit, X, Plus, Trash2
} from 'lucide-react';
import api from '../services/api';

export default function PlanPanel({ toast, currentPlan, onPlanUpdate, sourceSchema, targetSchema, aiAnalysis }) {
  const [editMode, setEditMode] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState({});
  const primaryKeyCount = mappings.filter(m => m.isPrimaryKey).length;

  useEffect(() => {
    if (currentPlan?.mappings) {
      setMappings(JSON.parse(JSON.stringify(currentPlan.mappings)));
    }
  }, [currentPlan]);

  // ── Load existing plans if no current plan ──
  useEffect(() => {
    if (!currentPlan) {
      api.getPlans().then(data => {
        if (data.plans?.length > 0) {
          const latest = data.plans[data.plans.length - 1];
          api.getPlan(latest.id).then(d => onPlanUpdate(d.plan)).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  const handleSave = async () => {
    setLoading(p => ({ ...p, save: true }));
    try {
      const result = await api.savePlan({
        ...currentPlan,
        mappings
      });
      onPlanUpdate(result.plan);
      setEditMode(false);
      toast(`Plan saved (v${result.plan.version})`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, save: false }));
    }
  };

  const handleApprove = async () => {
    if (!currentPlan?.id) return;
    setLoading(p => ({ ...p, approve: true }));
    try {
      const result = await api.approvePlan(currentPlan.id);
      onPlanUpdate(result.plan);
      toast('Migration plan approved! You can now execute it.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, approve: false }));
    }
  };

  const updateMapping = (index, field, value) => {
    setMappings(prev => {
      const copy = [...prev];
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        copy[index] = { ...copy[index], [parent]: { ...copy[index][parent], [child]: value } };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  // Exactly one mapping may be the primary key — it drives retry duplicate detection.
  const setPrimaryKey = (index, checked) => {
    setMappings(prev => prev.map((m, i) => ({ ...m, isPrimaryKey: checked && i === index })));
  };

  const removeMapping = (index) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  const addMapping = () => {
    setMappings(prev => [...prev, {
      sourceField: '',
      targetField: '',
      transformation: { type: 'rename' },
      confidence: 1,
      risk: 'low',
      reasoning: 'Manual mapping',
      isPrimaryKey: false
    }]);
  };

  if (!currentPlan && !aiAnalysis) {
    return (
      <div>
        <div className="panel-header">
          <h1><FileText size={28} /> <span className="gradient-text">Migration Plan</span></h1>
        </div>
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Migration Plan</h3>
          <p>Use the AI Agent tab to analyze schemas and create a migration plan, or create one manually.</p>
          <button className="btn btn-primary" onClick={async () => {
            try {
              const result = await api.savePlan({ mappings: [] });
              onPlanUpdate(result.plan);
              setEditMode(true);
              toast('Empty plan created — add mappings manually', 'info');
            } catch (e) { toast(e.message, 'error'); }
          }} id="btn-create-empty-plan">
            <Plus size={16} /> Create Empty Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="panel-header">
        <h1><FileText size={28} /> <span className="gradient-text">Migration Plan</span></h1>
        <p>Review, edit, and approve the field mapping plan before execution.</p>
      </div>

      {/* ── Plan Info ── */}
      {currentPlan && (
        <div className="section">
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-label">Plan ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--violet-light)', marginTop: 4 }}>{currentPlan.id}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Version</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>v{currentPlan.version}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Status</div>
              <div style={{ marginTop: 4 }}>
                <span className={`badge ${currentPlan.status === 'approved' ? 'badge-success' : currentPlan.status === 'draft' ? 'badge-warning' : 'badge-info'}`}
                  style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                  {currentPlan.status?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Mappings</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{mappings.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="section">
        <div className="btn-group">
          {!editMode ? (
            <button className="btn" onClick={() => setEditMode(true)} disabled={currentPlan?.status === 'approved'} id="btn-edit-plan">
              <Edit size={16} /> Edit Mappings
            </button>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading.save} id="btn-save-plan">
                {loading.save ? <Loader size={16} className="animate-pulse" /> : <Save size={16} />}
                Save Plan
              </button>
              <button className="btn" onClick={() => { setEditMode(false); setMappings(JSON.parse(JSON.stringify(currentPlan?.mappings || []))); }}>
                <X size={16} /> Cancel
              </button>
            </>
          )}
          {currentPlan?.status === 'draft' && !editMode && (
            <button className="btn btn-success btn-lg" onClick={handleApprove}
              disabled={loading.approve || mappings.length === 0 || primaryKeyCount !== 1} id="btn-approve-plan">
              {loading.approve ? <Loader size={16} className="animate-pulse" /> : <ThumbsUp size={16} />}
              Approve Plan
            </button>
          )}
          {currentPlan?.status === 'approved' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600 }}>
              <CheckCircle size={18} /> Plan approved — go to Execute tab
            </span>
          )}
        </div>
        {currentPlan?.status === 'draft' && mappings.length > 0 && primaryKeyCount !== 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-3)', color: 'var(--warning)' }}>
            <AlertTriangle size={16} />
            <span>
              {primaryKeyCount === 0
                ? 'Mark exactly one mapping as the Primary Key before approving — it identifies records so a retried migration skips duplicates instead of inserting them twice.'
                : `${primaryKeyCount} mappings are marked as Primary Key. Exactly one is required.`}
            </span>
          </div>
        )}
      </div>

      {/* ── Mappings Table ── */}
      <div className="section">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span>Field Mappings</span>
          {editMode && (
            <button className="btn btn-sm" onClick={addMapping}>
              <Plus size={14} /> Add Mapping
            </button>
          )}
        </div>

        {mappings.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <AlertTriangle size={32} />
            <h3>No mappings defined</h3>
            <p>Add field mappings to define how source fields map to target fields.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Source Field</th>
                  <th></th>
                  <th>Target Field</th>
                  <th>Transform Type</th>
                  <th>Risk</th>
                  <th>Primary Key</th>
                  {editMode && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {mappings.map((m, i) => (
                  <tr key={i}>
                    <td>
                      {editMode ? (
                        <input className="input" value={m.sourceField || ''} onChange={(e) => updateMapping(i, 'sourceField', e.target.value)}
                          placeholder="source_field" style={{ minWidth: 120 }} />
                      ) : (
                        <code style={{ color: 'var(--cyan-light)' }}>{m.sourceField}</code>
                      )}
                    </td>
                    <td className="mapping-arrow"><ArrowRight size={14} /></td>
                    <td>
                      {editMode ? (
                        <input className="input" value={m.targetField || ''} onChange={(e) => updateMapping(i, 'targetField', e.target.value)}
                          placeholder="target_field" style={{ minWidth: 120 }} />
                      ) : (
                        <code style={{ color: 'var(--violet-light)' }}>{m.targetField}</code>
                      )}
                    </td>
                    <td>
                      {editMode ? (
                        <select className="select" value={m.transformation?.type || 'rename'} onChange={(e) => updateMapping(i, 'transformation.type', e.target.value)}
                          style={{ minWidth: 100 }}>
                          <option value="rename">rename</option>
                          <option value="typecast">typecast</option>
                          <option value="dateformat">dateformat</option>
                          <option value="concat">concat</option>
                          <option value="split">split</option>
                          <option value="default">default</option>
                          <option value="trim">trim</option>
                          <option value="uppercase">uppercase</option>
                          <option value="lowercase">lowercase</option>
                          <option value="map_values">map_values</option>
                          <option value="computed">computed</option>
                        </select>
                      ) : (
                        <span className="badge badge-neutral">{m.transformation?.type || 'rename'}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${m.risk === 'low' ? 'success' : m.risk === 'medium' ? 'warning' : 'error'}`}>
                        {m.risk || 'low'}
                      </span>
                    </td>
                    <td>
                      {editMode ? (
                        <input type="checkbox" checked={!!m.isPrimaryKey}
                          onChange={(e) => setPrimaryKey(i, e.target.checked)}
                          style={{ width: 16, height: 16, accentColor: 'var(--violet)' }} />
                      ) : (
                        m.isPrimaryKey ? <CheckCircle size={16} style={{ color: 'var(--success)' }} /> : '—'
                      )}
                    </td>
                    {editMode && (
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => removeMapping(i)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Plan JSON ── */}
      {currentPlan && !editMode && (
        <div className="section">
          <div className="section-title">Plan Details (JSON)</div>
          <div className="json-display">
            {JSON.stringify(currentPlan, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
