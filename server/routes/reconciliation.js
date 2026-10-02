const express = require('express');
const router = express.Router();
const store = require('../store/inMemoryStore');
const { reconcile, compareRecords } = require('../engine/reconciliationEngine');

// GET /api/reconciliation/:execId — Reconciliation report
router.get('/:execId', (req, res) => {
  try {
    const report = reconcile(req.params.execId);
    res.json({ success: true, report });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/reconciliation/:execId/compare — Side-by-side comparison
router.get('/:execId/compare', (req, res) => {
  try {
    const comparison = compareRecords(req.params.execId);
    res.json({ success: true, comparison });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/reconciliation/:execId/quarantine — Quarantined records for execution
router.get('/:execId/quarantine', (req, res) => {
  try {
    const records = store.quarantinedRecords.filter(r => r.executionId === req.params.execId);
    res.json({ records, total: records.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
