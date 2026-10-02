import React, { useState } from 'react';
import {
  Brain, Loader, ArrowRight, AlertTriangle, HelpCircle,
  CheckCircle, Shield, Sparkles, FileText
} from 'lucide-react';
import api from '../services/api';

export default function AgentPanel({ toast, aiReady, sourceSchema, targetSchema, aiAnalysis, onAnalysisComplete, onCreatePlan }) {
  const [loading, setLoading] = useState({});
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [questions, setQuestions] = useState(null);

  // ── Run AI Analysis ──
  const handleAnalyze = async () => {
    setLoading(p => ({ ...p, analyze: true }));
    try {
      const result = await api.analyzeSchemas();
      onAnalysisComplete(result.analysis);
      toast('AI analysis complete — review the proposed mappings', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, analyze: false }));
    }
  };

  // ── Risk Assessment ──
  const handleRisks = async () => {
    if (!aiAnalysis?.mappings) return toast('Run analysis first', 'warning');
    setLoading(p => ({ ...p, risks: true }));
    try {
      const result = await api.assessRisks(aiAnalysis.mappings);
      setRiskAnalysis(result.riskAnalysis);
      toast('Risk assessment complete', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, risks: false }));
    }
  };

  // ── Generate Questions ──
  const handleQuestions = async () => {
    setLoading(p => ({ ...p, questions: true }));
    try {
      const result = await api.generateQuestions(aiAnalysis?.mappings || []);
      setQuestions(result.questions);
      toast(`Generated ${result.questions?.length || 0} clarification questions`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, questions: false }));
    }
  };

  // ── Create Plan from Analysis ──
  const handleCreatePlan = async () => {
    if (!aiAnalysis?.mappings) return;
    setLoading(p => ({ ...p, plan: true }));
    try {
      const result = await api.savePlan({
        mappings: aiAnalysis.mappings,
        aiSummary: aiAnalysis.summary,
        unmappedSourceFields: aiAnalysis.unmappedSourceFields,
        unmappedTargetFields: aiAnalysis.unmappedTargetFields,
      });
      onCreatePlan(result.plan);
      toast('Migration plan created from AI analysis', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, plan: false }));
    }
  };

  // ── Gate checks ──
  if (!aiReady) {
    return (
      <div>
        <div className="panel-header">
          <h1><Brain size={28} /> <span className="gradient-text">AI Agent</span></h1>
        </div>
        <div className="empty-state">
          <Brain size={48} />
          <h3>AI Agent Not Configured</h3>
          <p>
            Set the <code>GEMINI_API_KEY</code> environment variable on the server, then restart or
            redeploy. Use the value <code>mock</code> to run without a real key. You can still build the
            mapping plan by hand on the Plan tab.
          </p>
        </div>
      </div>
    );
  }

  if (!sourceSchema || !targetSchema) {
    return (
      <div>
        <div className="panel-header">
          <h1><Brain size={28} /> <span className="gradient-text">AI Agent</span></h1>
        </div>
        <div className="empty-state">
          <AlertTriangle size={48} />
          <h3>Schemas Not Configured</h3>
          <p>Set both source and target schemas in the Setup tab before running AI analysis.</p>
        </div>
      </div>
    );
  }

  const riskColor = (risk) => {
    if (risk === 'low') return 'var(--success)';
    if (risk === 'medium') return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div>
      <div className="panel-header">
        <h1><Brain size={28} /> <span className="gradient-text">AI Agent</span></h1>
        <p>Let the AI analyze your schemas, propose field mappings, identify risks, and generate clarification questions.</p>
      </div>

      {/* ── Action Buttons ── */}
      <div className="section">
        <div className="btn-group" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={loading.analyze} id="btn-analyze">
            {loading.analyze ? <Loader size={18} className="animate-pulse" /> : <Sparkles size={18} />}
            {loading.analyze ? 'Analyzing Schemas...' : 'Analyze & Propose Mappings'}
          </button>
          <button className="btn btn-lg" onClick={handleRisks} disabled={loading.risks || !aiAnalysis} id="btn-risks">
            {loading.risks ? <Loader size={18} className="animate-pulse" /> : <Shield size={18} />}
            Assess Risks
          </button>
          <button className="btn btn-lg" onClick={handleQuestions} disabled={loading.questions} id="btn-questions">
            {loading.questions ? <Loader size={18} className="animate-pulse" /> : <HelpCircle size={18} />}
            Generate Questions
          </button>
        </div>
      </div>

      {/* ── AI Analysis Results ── */}
      {aiAnalysis && (
        <div className="fade-in">
          {/* Summary */}
          {aiAnalysis.summary && (
            <div className="section">
              <div className="card" style={{ borderColor: 'var(--violet-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <Sparkles size={18} style={{ color: 'var(--violet-light)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>AI Summary</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{aiAnalysis.summary}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Proposed Mappings */}
          <div className="section">
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ArrowRight size={18} /> Proposed Mappings ({aiAnalysis.mappings?.length || 0})
              </span>
              <button className="btn btn-primary btn-sm" onClick={handleCreatePlan} disabled={loading.plan} id="btn-create-plan">
                {loading.plan ? <Loader size={14} className="animate-pulse" /> : <FileText size={14} />}
                Create Migration Plan
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Source Field</th>
                    <th></th>
                    <th>Target Field</th>
                    <th>Transform</th>
                    <th>Confidence</th>
                    <th>Risk</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {aiAnalysis.mappings?.map((m, i) => (
                    <tr key={i}>
                      <td><code style={{ color: 'var(--cyan-light)' }}>{m.sourceField}</code></td>
                      <td className="mapping-arrow"><ArrowRight size={14} /></td>
                      <td><code style={{ color: 'var(--violet-light)' }}>{m.targetField}</code></td>
                      <td><span className="badge badge-neutral">{m.transformation?.type || 'rename'}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-bar" style={{ width: 50, height: 4 }}>
                            <div className="progress-fill" style={{ width: `${(m.confidence || 0) * 100}%` }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{Math.round((m.confidence || 0) * 100)}%</span>
                        </div>
                      </td>
                      <td><span className={`badge badge-${m.risk === 'low' ? 'success' : m.risk === 'medium' ? 'warning' : 'error'}`}>{m.risk}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 250 }}>{m.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmapped Fields */}
          {(aiAnalysis.unmappedSourceFields?.length > 0 || aiAnalysis.unmappedTargetFields?.length > 0) && (
            <div className="section">
              <div className="section-title"><AlertTriangle size={18} /> Unmapped Fields</div>
              <div className="schema-grid">
                {aiAnalysis.unmappedSourceFields?.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ color: 'var(--warning)', marginBottom: 'var(--space-3)' }}>
                      Source Fields (no target match)
                    </div>
                    {aiAnalysis.unmappedSourceFields.map((f, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                        <code style={{ color: 'var(--text-primary)' }}>{f.field}</code>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {f.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiAnalysis.unmappedTargetFields?.length > 0 && (
                  <div className="card">
                    <div className="card-title" style={{ color: 'var(--info)', marginBottom: 'var(--space-3)' }}>
                      Target Fields (no source match)
                    </div>
                    {aiAnalysis.unmappedTargetFields.map((f, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                        <code style={{ color: 'var(--text-primary)' }}>{f.field}</code>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {f.suggestion}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Risks */}
          {aiAnalysis.risks?.length > 0 && (
            <div className="section">
              <div className="section-title"><Shield size={18} /> Identified Risks</div>
              {aiAnalysis.risks.map((r, i) => (
                <div key={i} className="card" style={{ marginBottom: 'var(--space-3)', borderColor: riskColor(r.severity) + '33' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`badge badge-${r.severity === 'low' ? 'success' : r.severity === 'medium' ? 'warning' : 'error'}`}>{r.severity}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.description}</span>
                  </div>
                  {r.affectedFields && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                      Affected: {r.affectedFields.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Risk Analysis ── */}
      {riskAnalysis && (
        <div className="section fade-in">
          <div className="section-title"><Shield size={18} /> Detailed Risk Assessment</div>
          <div className="card">
            <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div>
                <span className="label">Overall Risk</span>
                <span className={`badge badge-${riskAnalysis.overallRisk === 'low' ? 'success' : riskAnalysis.overallRisk === 'medium' ? 'warning' : 'error'}`}
                  style={{ fontSize: '0.9rem', padding: '4px 14px' }}>
                  {riskAnalysis.overallRisk?.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="label">Risk Score</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: riskColor(riskAnalysis.overallRisk) }}>
                  {riskAnalysis.riskScore ? `${Math.round(riskAnalysis.riskScore * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
            {riskAnalysis.risks?.map((r, i) => (
              <div key={i} style={{ padding: 'var(--space-3) 0', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${r.severity === 'low' ? 'success' : r.severity === 'medium' ? 'warning' : 'error'}`}>{r.severity}</span>
                  <span className="badge badge-neutral">{r.category}</span>
                </div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', margin: '6px 0 4px' }}>{r.description}</p>
                {r.mitigation && <p style={{ color: 'var(--success)', fontSize: '0.82rem' }}>💡 {r.mitigation}</p>}
              </div>
            ))}
            {riskAnalysis.recommendations?.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Recommendations:</div>
                <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {riskAnalysis.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Questions ── */}
      {questions?.length > 0 && (
        <div className="section fade-in">
          <div className="section-title"><HelpCircle size={18} /> Clarification Questions ({questions.length})</div>
          {questions.map((q, i) => (
            <div key={i} className="question-card">
              <div className="question-category">{q.category} • {q.priority} priority</div>
              <div className="question-text">{q.question}</div>
              <div className="question-context">{q.context}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!aiAnalysis && (
        <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
          <Sparkles size={48} />
          <h3>Ready to Analyze</h3>
          <p>Click "Analyze & Propose Mappings" to let the AI examine your schemas and suggest a migration plan.</p>
        </div>
      )}
    </div>
  );
}
