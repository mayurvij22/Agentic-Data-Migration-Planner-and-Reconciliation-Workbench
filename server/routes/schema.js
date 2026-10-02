const express = require('express');
const router = express.Router();
const store = require('../store/inMemoryStore');

// POST /api/schema/source — Set source schema
router.post('/source', (req, res) => {
  try {
    const schema = req.body;
    if (!schema.name || !schema.fields || !Array.isArray(schema.fields)) {
      return res.status(400).json({ error: 'Schema must have "name" (string) and "fields" (array)' });
    }
    for (const f of schema.fields) {
      if (!f.name || !f.type) {
        return res.status(400).json({ error: `Each field must have "name" and "type". Invalid: ${JSON.stringify(f)}` });
      }
    }
    const result = store.setSourceSchema(schema);
    res.json({ success: true, schema: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schema/target — Set target schema
router.post('/target', (req, res) => {
  try {
    const schema = req.body;
    if (!schema.name || !schema.fields || !Array.isArray(schema.fields)) {
      return res.status(400).json({ error: 'Schema must have "name" (string) and "fields" (array)' });
    }
    for (const f of schema.fields) {
      if (!f.name || !f.type) {
        return res.status(400).json({ error: `Each field must have "name" and "type". Invalid: ${JSON.stringify(f)}` });
      }
    }
    const result = store.setTargetSchema(schema);
    res.json({ success: true, schema: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schema — Get both schemas
router.get('/', (req, res) => {
  res.json({
    sourceSchema: store.sourceSchema,
    targetSchema: store.targetSchema,
    sourceRecordCount: store.sourceRecords.length,
    maxSampleSize: store.maxSampleSize
  });
});

// POST /api/schema/source/records — Upload source records
router.post('/source/records', (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Body must contain "records" array' });
    }
    if (records.length === 0) {
      return res.status(400).json({ error: 'Records array cannot be empty' });
    }
    const result = store.setSourceRecords(records);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/schema/source/records — Get source records (paginated)
router.get('/source/records', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const start = (page - 1) * limit;
  const records = store.sourceRecords.slice(start, start + limit);
  res.json({
    records,
    total: store.sourceRecords.length,
    page,
    limit,
    totalPages: Math.ceil(store.sourceRecords.length / limit)
  });
});

module.exports = router;
