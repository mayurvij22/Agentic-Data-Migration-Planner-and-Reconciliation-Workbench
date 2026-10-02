const express = require('express');
const router = express.Router();
const store = require('../store/inMemoryStore');
const { isInitialized, analyzeSchemas, assessRisks, generateQuestions } = require('../ai/geminiAgent');
const { getSupportedTransformations } = require('../engine/transformations');

// GET /api/agent/status — Check if AI is initialized from GEMINI_API_KEY
router.get('/status', (req, res) => {
  res.json({ initialized: isInitialized() });
});

// POST /api/agent/analyze — AI analyzes schemas and proposes mappings
router.post('/analyze', async (req, res) => {
  try {
    if (!store.sourceSchema || !store.targetSchema) {
      return res.status(400).json({ error: 'Both source and target schemas must be configured first' });
    }
    const transformations = getSupportedTransformations();
    const analysis = await analyzeSchemas(store.sourceSchema, store.targetSchema, transformations);

    store.addAuditEntry('AI_ANALYSIS', 'AI schema analysis completed', {
      mappingsProposed: analysis.mappings?.length || 0,
      unmappedSource: analysis.unmappedSourceFields?.length || 0,
      unmappedTarget: analysis.unmappedTargetFields?.length || 0,
      questionsGenerated: analysis.questions?.length || 0
    });

    res.json({ success: true, analysis });
  } catch (error) {
    store.addAuditEntry('AI_ERROR', `AI analysis failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/risks — AI risk assessment for mappings
router.post('/risks', async (req, res) => {
  try {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Mappings array is required' });
    }
    if (!store.sourceSchema || !store.targetSchema) {
      return res.status(400).json({ error: 'Both schemas must be configured' });
    }
    const riskAnalysis = await assessRisks(mappings, store.sourceSchema, store.targetSchema);

    store.addAuditEntry('AI_RISK_ASSESSMENT', 'AI risk assessment completed', {
      overallRisk: riskAnalysis.overallRisk,
      riskCount: riskAnalysis.risks?.length || 0
    });

    res.json({ success: true, riskAnalysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/questions — AI generates clarification questions
router.post('/questions', async (req, res) => {
  try {
    const { mappings } = req.body;
    if (!store.sourceSchema || !store.targetSchema) {
      return res.status(400).json({ error: 'Both schemas must be configured' });
    }
    const result = await generateQuestions(store.sourceSchema, store.targetSchema, mappings || []);

    store.addAuditEntry('AI_QUESTIONS', 'AI clarification questions generated', {
      questionCount: result.questions?.length || 0
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
