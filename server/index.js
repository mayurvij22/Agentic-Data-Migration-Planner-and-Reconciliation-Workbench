const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const schemaRoutes = require('./routes/schema');
const migrationRoutes = require('./routes/migration');
const agentRoutes = require('./routes/agent');
const reconciliationRoutes = require('./routes/reconciliation');
const store = require('./store/inMemoryStore');
const { initializeAI } = require('./ai/geminiAgent');

const app = express();

// ──────────── Middleware ────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging (non-production)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ──────────── API Routes ────────────
app.use('/api/schema', schemaRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/reconciliation', reconciliationRoutes);

// GET /api/history — Full audit history
app.get('/api/history', (req, res) => {
  const { action, limit: limitStr } = req.query;
  let logs = store.auditLog;
  if (action) {
    logs = logs.filter(l => l.action === action);
  }
  const limit = Math.min(parseInt(limitStr) || 200, 500);
  res.json({
    history: logs.slice(-limit).reverse(),
    total: logs.length
  });
});

// GET /api/quarantine — All quarantined records
app.get('/api/quarantine', (req, res) => {
  res.json({
    records: store.quarantinedRecords.slice(-100),
    total: store.quarantinedRecords.length
  });
});

// GET /api/health — Health check + store summary
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    store: {
      hasSourceSchema: !!store.sourceSchema,
      hasTargetSchema: !!store.targetSchema,
      sourceRecords: store.sourceRecords.length,
      targetRecords: store.targetRecords.length,
      quarantinedRecords: store.quarantinedRecords.length,
      plans: store.migrationPlans.length,
      executions: store.migrationExecutions.length,
      auditEntries: store.auditLog.length
    }
  });
});

// POST /api/reset — Reset in-memory store
app.post('/api/reset', (req, res) => {
  store.reset();
  store.addAuditEntry('STORE_RESET', 'In-memory store has been reset');
  res.json({ success: true, message: 'Store reset successfully' });
});

// ──────────── Auto-initialize AI if key in env ────────────
if (process.env.GEMINI_API_KEY) {
  try {
    initializeAI(process.env.GEMINI_API_KEY);
    console.log('AI agent auto-initialized from GEMINI_API_KEY env variable');
  } catch (e) {
    console.warn('Failed to auto-initialize AI:', e.message);
  }
}

// ──────────── Serve static files in production ────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    }
  });
}

// ──────────── Start server (non-serverless) ────────────
const PORT = process.env.PORT || 3001;
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 Migration Planner API running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;
