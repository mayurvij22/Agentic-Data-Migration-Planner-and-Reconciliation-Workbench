import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Database, Brain, FileText, Play, GitCompare, History,
  Settings, ChevronRight, Zap, AlertTriangle, CheckCircle, XCircle,
  ArrowRight, RotateCcw
} from 'lucide-react';
import api from './services/api';
import SetupPanel from './components/SetupPanel';
import AgentPanel from './components/AgentPanel';
import PlanPanel from './components/PlanPanel';
import ExecutionPanel from './components/ExecutionPanel';
import HistoryPanel from './components/HistoryPanel';
import './App.css';

/* ── Toast System ── */
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, toast: add };
}

/* ── Sidebar Navigation Items ── */
const NAV_ITEMS = [
  { id: 'setup', label: 'Setup', icon: Database, desc: 'Schemas & Records' },
  { id: 'agent', label: 'AI Agent', icon: Brain, desc: 'Analyze & Map' },
  { id: 'plan', label: 'Plan', icon: FileText, desc: 'Review & Approve' },
  { id: 'execute', label: 'Execute', icon: Play, desc: 'Run & Reconcile' },
  { id: 'history', label: 'History', icon: History, desc: 'Audit Log' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('setup');
  const [apiKey, setApiKey] = useState('');
  const [aiReady, setAiReady] = useState(false);

  // ── App state ──
  const [sourceSchema, setSourceSchema] = useState(null);
  const [targetSchema, setTargetSchema] = useState(null);
  const [sourceRecordCount, setSourceRecordCount] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [executions, setExecutions] = useState([]);

  const { toasts, toast } = useToast();

  // ── Check health on mount ──
  useEffect(() => {
    api.health().then(data => {
      if (data.store?.hasSourceSchema) setSourceSchema(true);
      if (data.store?.hasTargetSchema) setTargetSchema(true);
      if (data.store?.sourceRecords > 0) setSourceRecordCount(data.store.sourceRecords);
    }).catch(() => {});

    api.agentStatus().then(data => {
      if (data.initialized) setAiReady(true);
    }).catch(() => {});
  }, []);

  // ── Workflow progress ──
  const progress = [
    { done: !!sourceSchema && !!targetSchema, label: 'Schemas' },
    { done: sourceRecordCount > 0, label: 'Records' },
    { done: !!aiAnalysis, label: 'AI Analysis' },
    { done: !!currentPlan, label: 'Plan' },
    { done: currentPlan?.status === 'approved', label: 'Approved' },
    { done: executions.some(e => e.type === 'execute' && e.status === 'completed'), label: 'Migrated' },
  ];
  const progressPct = Math.round((progress.filter(p => p.done).length / progress.length) * 100);

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon"><Zap size={20} /></div>
            <div>
              <div className="logo-title">Migration Planner</div>
              <div className="logo-subtitle">Agentic Workbench</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={18} />
              <div className="nav-text">
                <span className="nav-label">{item.label}</span>
                <span className="nav-desc">{item.desc}</span>
              </div>
              {activeTab === item.id && <ChevronRight size={14} className="nav-arrow" />}
            </button>
          ))}
        </nav>

        {/* ── Progress ── */}
        <div className="sidebar-footer">
          <div className="progress-section">
            <div className="progress-header">
              <span className="label" style={{ margin: 0 }}>Workflow</span>
              <span style={{ color: 'var(--violet-light)', fontWeight: 700, fontSize: '0.85rem' }}>{progressPct}%</span>
            </div>
            <div className="progress-bar" style={{ marginTop: 6 }}>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="progress-steps">
              {progress.map((p, i) => (
                <div key={i} className={`progress-step ${p.done ? 'done' : ''}`}>
                  {p.done ? <CheckCircle size={12} /> : <div className="step-dot" />}
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <div className="content-inner fade-in" key={activeTab}>
          {activeTab === 'setup' && (
            <SetupPanel
              toast={toast}
              sourceSchema={sourceSchema}
              targetSchema={targetSchema}
              sourceRecordCount={sourceRecordCount}
              onSourceSchemaSet={setSourceSchema}
              onTargetSchemaSet={setTargetSchema}
              onRecordsLoaded={setSourceRecordCount}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              aiReady={aiReady}
              onAiReady={setAiReady}
            />
          )}
          {activeTab === 'agent' && (
            <AgentPanel
              toast={toast}
              aiReady={aiReady}
              sourceSchema={sourceSchema}
              targetSchema={targetSchema}
              aiAnalysis={aiAnalysis}
              onAnalysisComplete={setAiAnalysis}
              onCreatePlan={(plan) => { setCurrentPlan(plan); setActiveTab('plan'); }}
            />
          )}
          {activeTab === 'plan' && (
            <PlanPanel
              toast={toast}
              currentPlan={currentPlan}
              onPlanUpdate={setCurrentPlan}
              sourceSchema={sourceSchema}
              targetSchema={targetSchema}
              aiAnalysis={aiAnalysis}
            />
          )}
          {activeTab === 'execute' && (
            <ExecutionPanel
              toast={toast}
              currentPlan={currentPlan}
              executions={executions}
              onExecutionsUpdate={setExecutions}
            />
          )}
          {activeTab === 'history' && (
            <HistoryPanel toast={toast} />
          )}
        </div>
      </main>

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <CheckCircle size={16} />}
            {t.type === 'error' && <XCircle size={16} />}
            {t.type === 'warning' && <AlertTriangle size={16} />}
            {t.type === 'info' && <Zap size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
