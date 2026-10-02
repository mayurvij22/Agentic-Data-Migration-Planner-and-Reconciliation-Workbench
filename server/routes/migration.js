const express = require('express');
const router = express.Router();
const store = require('../store/inMemoryStore');
const { executeMigration } = require('../engine/migrationEngine');
const { rollbackExecution } = require('../engine/rollbackEngine');
const { getSupportedTransformations } = require('../engine/transformations');

// GET /api/migration/transformations — List supported transformations
router.get('/transformations', (req, res) => {
  res.json({ transformations: getSupportedTransformations() });
});

// POST /api/migration/plan — Create or update a migration plan
router.post('/plan', (req, res) => {
  try {
    const plan = req.body;
    if (!plan.mappings || !Array.isArray(plan.mappings)) {
      return res.status(400).json({ error: 'Plan must have a "mappings" array' });
    }
    for (const m of plan.mappings) {
      if (!m.targetField) {
        return res.status(400).json({ error: 'Each mapping must have a "targetField"' });
      }
    }
    const result = store.savePlan(plan);
    res.json({ success: true, plan: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/migration/plans — List all plan versions
router.get('/plans', (req, res) => {
  const plans = store.migrationPlans.map(p => ({
    id: p.id,
    version: p.version,
    status: p.status,
    mappingCount: p.mappings ? p.mappings.length : 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    approvedAt: p.approvedAt
  }));
  res.json({ plans });
});

// GET /api/migration/plan/:id — Get specific plan with full details
router.get('/plan/:id', (req, res) => {
  const plan = store.migrationPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
});

// PUT /api/migration/plan/:id/approve — Approve a plan (required before execution)
router.put('/plan/:id/approve', (req, res) => {
  try {
    const plan = store.approvePlan(req.params.id);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/migration/plan/:id/dry-run — Execute deterministic dry run
router.post('/plan/:id/dry-run', (req, res) => {
  try {
    const result = executeMigration(req.params.id, true);
    res.json({ success: true, execution: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/migration/plan/:id/execute — Execute approved migration
router.post('/plan/:id/execute', (req, res) => {
  try {
    const result = executeMigration(req.params.id, false);
    res.json({ success: true, execution: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/migration/executions — List all executions
router.get('/executions', (req, res) => {
  const executions = store.migrationExecutions.map(e => ({
    id: e.id,
    planId: e.planId,
    planVersion: e.planVersion,
    type: e.type,
    status: e.status,
    counts: e.counts,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    rolledBackAt: e.rolledBackAt
  }));
  res.json({ executions });
});

// GET /api/migration/execution/:id — Get specific execution with full details
router.get('/execution/:id', (req, res) => {
  const exec = store.migrationExecutions.find(e => e.id === req.params.id);
  if (!exec) return res.status(404).json({ error: 'Execution not found' });
  // Return without the large arrays to keep response manageable
  const summary = {
    ...exec,
    acceptedRecords: exec.acceptedRecords?.slice(0, 20),
    rejectedRecords: exec.rejectedRecords?.slice(0, 20),
    quarantinedRecords: exec.quarantinedRecords?.slice(0, 20),
    transformationLogs: exec.transformationLogs?.slice(0, 20),
    fieldErrors: exec.fieldErrors?.slice(0, 50),
    _truncated: {
      acceptedRecords: exec.acceptedRecords?.length,
      rejectedRecords: exec.rejectedRecords?.length,
      quarantinedRecords: exec.quarantinedRecords?.length,
      transformationLogs: exec.transformationLogs?.length,
      fieldErrors: exec.fieldErrors?.length
    }
  };
  res.json({ execution: summary });
});

// POST /api/migration/execution/:id/rollback — Rollback a migration
router.post('/execution/:id/rollback', (req, res) => {
  try {
    const result = rollbackExecution(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
