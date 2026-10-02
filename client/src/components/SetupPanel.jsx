import React, { useState } from 'react';
import { Database, Upload, Key, CheckCircle, AlertCircle, FileJson, Loader } from 'lucide-react';
import api from '../services/api';

/* ── Sample schemas for quick-start demo ── */
const SAMPLE_SOURCE = {
  name: "employees",
  fields: [
    { name: "emp_id", type: "integer", required: true },
    { name: "first_name", type: "string", required: true, maxLength: 50 },
    { name: "last_name", type: "string", required: true, maxLength: 50 },
    { name: "email_address", type: "email", required: true },
    { name: "hire_date", type: "date", required: false },
    { name: "department", type: "string", required: false },
    { name: "salary", type: "number", required: false },
    { name: "is_active", type: "string", required: false },
    { name: "phone", type: "string", required: false }
  ]
};

const SAMPLE_TARGET = {
  name: "staff_members",
  fields: [
    { name: "id", type: "integer", required: true },
    { name: "fullName", type: "string", required: true, maxLength: 100 },
    { name: "email", type: "email", required: true },
    { name: "startDate", type: "string", required: true },
    { name: "dept", type: "string", required: false, enum: ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations"] },
    { name: "compensation", type: "number", required: false, min: 0 },
    { name: "active", type: "boolean", required: true },
    { name: "contactPhone", type: "string", required: false }
  ]
};

const SAMPLE_RECORDS = [
  { emp_id: 1, first_name: "Alice", last_name: "Johnson", email_address: "alice@company.com", hire_date: "2020-03-15", department: "Engineering", salary: 95000, is_active: "true", phone: "555-0101" },
  { emp_id: 2, first_name: "Bob", last_name: "Smith", email_address: "bob@company.com", hire_date: "2019-07-22", department: "Sales", salary: 72000, is_active: "true", phone: "555-0102" },
  { emp_id: 3, first_name: "Carol", last_name: "Williams", email_address: "carol@company.com", hire_date: "2021-01-10", department: "Marketing", salary: 68000, is_active: "false", phone: "555-0103" },
  { emp_id: 4, first_name: "David", last_name: "Brown", email_address: "david@company.com", hire_date: "2018-11-30", department: "HR", salary: 71000, is_active: "true", phone: null },
  { emp_id: 5, first_name: "Eve", last_name: "Davis", email_address: "invalid-email", hire_date: "not-a-date", department: "Finance", salary: 88000, is_active: "yes", phone: "555-0105" },
  { emp_id: 6, first_name: "Frank", last_name: "Miller", email_address: "frank@company.com", hire_date: "2022-05-01", department: "Operations", salary: -5000, is_active: "true", phone: "555-0106" },
  { emp_id: 7, first_name: "Grace", last_name: "Wilson", email_address: "grace@company.com", hire_date: "2023-08-14", department: "Engineering", salary: 105000, is_active: "true", phone: "555-0107" },
  { emp_id: 8, first_name: "", last_name: "Taylor", email_address: "taylor@company.com", hire_date: "2020-12-01", department: "Sales", salary: 65000, is_active: "true", phone: "555-0108" },
  { emp_id: 9, first_name: "Ivan", last_name: "Anderson", email_address: "ivan@company.com", hire_date: "2021-06-15", department: "Marketing", salary: 73000, is_active: "false", phone: "" },
  { emp_id: 10, first_name: "Julia", last_name: "Thomas", email_address: "julia@company.com", hire_date: "2019-04-20", department: "HR", salary: 78000, is_active: "true", phone: "555-0110" }
];

export default function SetupPanel({
  toast, sourceSchema, targetSchema, sourceRecordCount,
  onSourceSchemaSet, onTargetSchemaSet, onRecordsLoaded, aiReady
}) {
  const [srcInput, setSrcInput] = useState('');
  const [tgtInput, setTgtInput] = useState('');
  const [recInput, setRecInput] = useState('');
  const [loading, setLoading] = useState({});

  const handleSetSchema = async (type) => {
    const input = type === 'source' ? srcInput : tgtInput;
    const key = `schema_${type}`;
    setLoading(p => ({ ...p, [key]: true }));
    try {
      const schema = JSON.parse(input);
      const fn = type === 'source' ? api.setSourceSchema : api.setTargetSchema;
      await fn(schema);
      if (type === 'source') onSourceSchemaSet(schema);
      else onTargetSchemaSet(schema);
      toast(`${type} schema set successfully`, 'success');
    } catch (e) {
      toast(e.message.includes('JSON') ? 'Invalid JSON format' : e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  };

  const handleUploadRecords = async () => {
    setLoading(p => ({ ...p, records: true }));
    try {
      const records = JSON.parse(recInput);
      if (!Array.isArray(records)) throw new Error('Records must be a JSON array');
      const result = await api.uploadRecords(records);
      onRecordsLoaded(result.count);
      toast(`Loaded ${result.count} source records`, 'success');
    } catch (e) {
      toast(e.message.includes('JSON') ? 'Invalid JSON — must be an array of objects' : e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, records: false }));
    }
  };

  const loadSampleData = async () => {
    setLoading(p => ({ ...p, sample: true }));
    try {
      await api.setSourceSchema(SAMPLE_SOURCE);
      onSourceSchemaSet(SAMPLE_SOURCE);
      setSrcInput(JSON.stringify(SAMPLE_SOURCE, null, 2));

      await api.setTargetSchema(SAMPLE_TARGET);
      onTargetSchemaSet(SAMPLE_TARGET);
      setTgtInput(JSON.stringify(SAMPLE_TARGET, null, 2));

      const result = await api.uploadRecords(SAMPLE_RECORDS);
      onRecordsLoaded(result.count);
      setRecInput(JSON.stringify(SAMPLE_RECORDS, null, 2));

      toast('Sample data loaded — Employee → Staff migration', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(p => ({ ...p, sample: false }));
    }
  };

  return (
    <div>
      <div className="panel-header">
        <h1><Database size={28} /> <span className="gradient-text">Setup</span></h1>
        <p>Configure your source and target schemas, upload sample records, and connect the AI agent.</p>
      </div>

      {/* ── Quick Start ── */}
      <div className="section">
        <div className="card" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--violet-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>🚀 Quick Start</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                Load a sample Employee → Staff migration dataset with 10 records (including edge cases)
              </p>
            </div>
            <button className="btn btn-primary" onClick={loadSampleData} disabled={loading.sample} id="btn-load-sample">
              {loading.sample ? <Loader size={16} className="animate-pulse" /> : <Upload size={16} />}
              Load Sample Data
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="stat-grid" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <span className={`status-dot ${sourceSchema ? 'success' : 'warning'}`} />
            <span className="stat-label">Source Schema</span>
          </div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{sourceSchema ? '✓ Set' : 'Not set'}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <span className={`status-dot ${targetSchema ? 'success' : 'warning'}`} />
            <span className="stat-label">Target Schema</span>
          </div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{targetSchema ? '✓ Set' : 'Not set'}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <span className={`status-dot ${sourceRecordCount > 0 ? 'success' : 'warning'}`} />
            <span className="stat-label">Source Records</span>
          </div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{sourceRecordCount || 0}</div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <span className={`status-dot ${aiReady ? 'success' : 'warning'}`} />
            <span className="stat-label">AI Agent</span>
          </div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{aiReady ? '✓ Ready' : 'Not init'}</div>
        </div>
      </div>

      {/* ── AI Status ── */}
      <div className="section">
        <div className="section-title"><Key size={18} /> Gemini AI Configuration</div>
        <div className="card">
          {aiReady ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot success" />
              <span style={{ color: 'var(--success)', fontSize: '0.88rem', fontWeight: 600 }}>
                AI agent is configured and ready for schema analysis
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: 'var(--warning)', fontSize: '0.88rem', fontWeight: 600 }}>
                  AI agent is not configured
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
                  Set the <code>GEMINI_API_KEY</code> environment variable on the server and restart or
                  redeploy. Use the value <code>mock</code> to run the agent without a real key. Everything
                  else in this workbench works without the AI agent — you can build the mapping plan by hand
                  on the Plan tab.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Schemas ── */}
      <div className="schema-grid">
        {/* Source Schema */}
        <div className="section">
          <div className="section-title"><FileJson size={18} /> Source Schema</div>
          <div className="card">
            <label className="label">Schema JSON</label>
            <textarea
              className="textarea"
              rows={12}
              placeholder={'{\n  "name": "table_name",\n  "fields": [\n    { "name": "id", "type": "integer", "required": true }\n  ]\n}'}
              value={srcInput}
              onChange={(e) => setSrcInput(e.target.value)}
              id="input-source-schema"
            />
            <div style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleSetSchema('source')} disabled={loading.schema_source || !srcInput.trim()} id="btn-set-source">
                {loading.schema_source ? <Loader size={14} className="animate-pulse" /> : <CheckCircle size={14} />}
                Set Source Schema
              </button>
            </div>
          </div>
        </div>

        {/* Target Schema */}
        <div className="section">
          <div className="section-title"><FileJson size={18} /> Target Schema</div>
          <div className="card">
            <label className="label">Schema JSON</label>
            <textarea
              className="textarea"
              rows={12}
              placeholder={'{\n  "name": "target_table",\n  "fields": [\n    { "name": "id", "type": "integer", "required": true }\n  ]\n}'}
              value={tgtInput}
              onChange={(e) => setTgtInput(e.target.value)}
              id="input-target-schema"
            />
            <div style={{ marginTop: 'var(--space-3)' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleSetSchema('target')} disabled={loading.schema_target || !tgtInput.trim()} id="btn-set-target">
                {loading.schema_target ? <Loader size={14} className="animate-pulse" /> : <CheckCircle size={14} />}
                Set Target Schema
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Source Records ── */}
      <div className="section">
        <div className="section-title"><Upload size={18} /> Source Records (max 500)</div>
        <div className="card">
          <label className="label">Records JSON Array</label>
          <textarea
            className="textarea"
            rows={10}
            placeholder={'[\n  { "id": 1, "name": "Alice", "email": "alice@example.com" },\n  { "id": 2, "name": "Bob", "email": "bob@example.com" }\n]'}
            value={recInput}
            onChange={(e) => setRecInput(e.target.value)}
            id="input-source-records"
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <button className="btn btn-primary btn-sm" onClick={handleUploadRecords} disabled={loading.records || !recInput.trim()} id="btn-upload-records">
              {loading.records ? <Loader size={14} className="animate-pulse" /> : <Upload size={14} />}
              Upload Records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
