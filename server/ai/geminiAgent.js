/**
 * Gemini AI Agent
 * Uses Google Gemini API to analyze schemas, propose field mappings,
 * assess risks, and generate clarification questions.
 * Includes a mock mode for local testing without an API key.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini model generations are retired on a rolling basis, so the model is
// configurable — a hardcoded id eventually starts returning 404.
const DEFAULT_MODEL = 'gemini-3.5-flash';

let genAI = null;
let model = null;
let isMock = false;
let activeKey = null;
let modelName = DEFAULT_MODEL;

/**
 * Initialize the AI agent with a Gemini API key.
 */
function initializeAI(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  if (apiKey.toLowerCase() === 'mock') {
    isMock = true;
    model = { isMock: true };
    return;
  }
  isMock = false;
  activeKey = apiKey;
  modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: modelName });
}

/**
 * Ask the API which models this key can actually use, so an unavailable
 * model produces an actionable error instead of a bare 404.
 */
async function listSupportedModels() {
  if (!activeKey) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${activeKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
  } catch (_) {
    return [];
  }
}

/**
 * Run a prompt and parse the JSON response.
 */
async function generateJSON(prompt, label) {
  let text;
  try {
    const result = await model.generateContent(prompt);
    text = result.response.text();
  } catch (error) {
    if (/not found|404|not supported/i.test(error.message)) {
      const available = await listSupportedModels();
      throw new Error(
        `Gemini model "${modelName}" is not available for this API key. ` +
        (available.length
          ? `Set the GEMINI_MODEL env variable to one of: ${available.slice(0, 8).join(', ')}`
          : 'Set the GEMINI_MODEL env variable to a current model id from https://ai.google.dev/gemini-api/docs/models')
      );
    }
    throw error;
  }

  // Strip markdown code fences if the model wrapped the JSON
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`AI returned invalid JSON for ${label}. Raw response: ${text.substring(0, 300)}`);
  }
}

/**
 * Check if AI is initialized.
 */
function isInitialized() {
  return model !== null;
}

/**
 * Analyze source and target schemas, propose field mappings.
 */
async function analyzeSchemas(sourceSchema, targetSchema, supportedTransformations) {
  if (!model) throw new Error('AI agent is not configured. Set the GEMINI_API_KEY environment variable on the server (use "mock" to run without a real key).');

  if (isMock) {
    // Mock response tailored to the Employee -> Staff sample data
    return new Promise(resolve => setTimeout(() => resolve({
      mappings: [
        { sourceField: "emp_id", targetField: "id", transformation: { type: "rename" }, confidence: 0.98, risk: "low", reasoning: "Exact ID mapping", isPrimaryKey: true },
        { sourceField: "first_name", targetField: "fullName", transformation: { type: "concat", sourceFields: ["first_name", "last_name"], separator: " " }, confidence: 0.85, risk: "medium", reasoning: "Combining first and last name" },
        { sourceField: "email_address", targetField: "email", transformation: { type: "rename" }, confidence: 0.95, risk: "low", reasoning: "Semantic match for email" },
        { sourceField: "hire_date", targetField: "startDate", transformation: { type: "dateformat", outputFormat: "YYYY-MM-DD" }, confidence: 0.9, risk: "low", reasoning: "Date field renaming and standardizing format" },
        { sourceField: "department", targetField: "dept", transformation: { type: "rename" }, confidence: 0.9, risk: "low", reasoning: "Abbreviation match" },
        { sourceField: "salary", targetField: "compensation", transformation: { type: "rename" }, confidence: 0.8, risk: "low", reasoning: "Synonym match for payment" },
        { sourceField: "is_active", targetField: "active", transformation: { type: "typecast", targetType: "boolean" }, confidence: 0.95, risk: "medium", reasoning: "Type conversion from string/yes-no to boolean needed" }
      ],
      unmappedSourceFields: [
        { field: "phone", reason: "No clear contact number field in target schema" }
      ],
      unmappedTargetFields: [
        { field: "contactPhone", suggestion: "Could potentially map from 'phone'" }
      ],
      risks: [
        { severity: "medium", description: "Boolean type casting for 'active' might fail on unexpected string values like 'yes' instead of 'true'.", affectedFields: ["is_active"] }
      ],
      questions: [
        "Should we map 'phone' to 'contactPhone' despite the name difference?",
        "Are there any specific date formats expected for 'startDate'?"
      ],
      summary: "High confidence mapping overall. A few fields require type casting (boolean) and concatenation (names). 'phone' was left unmapped but could map to 'contactPhone'."
    }), 1500));
  }

  const prompt = `You are an expert data migration consultant. Analyze the following source and target schemas and propose field mappings.

SOURCE SCHEMA (name: "${sourceSchema.name}"):
${JSON.stringify(sourceSchema.fields, null, 2)}

TARGET SCHEMA (name: "${targetSchema.name}"):
${JSON.stringify(targetSchema.fields, null, 2)}

SUPPORTED TRANSFORMATION TYPES:
${supportedTransformations.map(t => `- ${t.type}: ${t.description} (config: ${JSON.stringify(t.config)})`).join('\n')}

INSTRUCTIONS:
1. Analyze every source field and find the best matching target field based on name similarity, type compatibility, and semantic meaning.
2. For each mapping, suggest the most appropriate transformation from the supported list.
3. Identify source fields with no good target match and target fields with no source.
4. Assess risk levels (low, medium, high) for each mapping.
5. Generate 3-5 clarification questions for ambiguous or risky mappings.
6. Mark at most one mapping as isPrimaryKey: true (the field most likely to be a unique identifier).

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "mappings": [
    {
      "sourceField": "source_field_name",
      "targetField": "target_field_name",
      "transformation": { "type": "transformation_type" },
      "confidence": 0.95,
      "risk": "low",
      "reasoning": "Clear 1:1 name match with same type",
      "isPrimaryKey": false
    }
  ],
  "unmappedSourceFields": [
    { "field": "field_name", "reason": "No corresponding target field found" }
  ],
  "unmappedTargetFields": [
    { "field": "field_name", "suggestion": "Could be derived from..." }
  ],
  "risks": [
    { "severity": "high", "description": "Risk description", "affectedFields": ["field1"] }
  ],
  "questions": [
    "Clarification question about ambiguous mapping?"
  ],
  "summary": "Brief overall assessment of this migration"
}`;

  return generateJSON(prompt, 'schema analysis');
}

/**
 * Assess risks for a set of field mappings.
 */
async function assessRisks(mappings, sourceSchema, targetSchema) {
  if (!model) throw new Error('AI agent is not configured. Set the GEMINI_API_KEY environment variable on the server (use "mock" to run without a real key).');

  if (isMock) {
    return new Promise(resolve => setTimeout(() => resolve({
      overallRisk: "medium",
      riskScore: 0.4,
      risks: [
        {
          severity: "medium",
          category: "type_conversion",
          description: "Converting 'is_active' (string) to 'active' (boolean) may fail if source contains values other than 'true'/'false'.",
          affectedMappings: ["is_active → active"],
          mitigation: "Use a map_values transformation instead, or ensure source data is cleansed."
        },
        {
          severity: "low",
          category: "data_loss",
          description: "Concatenating first and last names makes it difficult to separate them later.",
          affectedMappings: ["first_name, last_name → fullName"],
          mitigation: "Ensure target schema genuinely doesn't need separated names."
        }
      ],
      recommendations: [
        "Review the unmapped 'phone' field.",
        "Verify date formats in the source system match the target expectations."
      ]
    }), 1000));
  }

  const prompt = `You are a data migration risk analyst. Assess the risks of the following field mappings:

MAPPINGS:
${JSON.stringify(mappings, null, 2)}

SOURCE SCHEMA: ${JSON.stringify(sourceSchema.fields, null, 2)}
TARGET SCHEMA: ${JSON.stringify(targetSchema.fields, null, 2)}

Analyze potential data loss, type conversion issues, constraint violations, and semantic mismatches.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "overallRisk": "low",
  "riskScore": 0.25,
  "risks": [
    {
      "severity": "high",
      "category": "data_loss",
      "description": "Detailed risk description",
      "affectedMappings": ["sourceField → targetField"],
      "mitigation": "Suggested mitigation"
    }
  ],
  "recommendations": ["Recommendation 1"]
}`;

  return generateJSON(prompt, 'risk assessment');
}

/**
 * Generate clarification questions for ambiguous mappings.
 */
async function generateQuestions(sourceSchema, targetSchema, mappings) {
  if (!model) throw new Error('AI agent is not configured. Set the GEMINI_API_KEY environment variable on the server (use "mock" to run without a real key).');

  if (isMock) {
    return new Promise(resolve => setTimeout(() => resolve({
      questions: [
        {
          category: "business_logic",
          question: "Should 'phone' be mapped to 'contactPhone'?",
          context: "The target schema has a 'contactPhone' field but it was left unmapped by the initial pass.",
          priority: "high"
        },
        {
          category: "data_quality",
          question: "Are there any standard date formats we must adhere to for 'startDate'?",
          context: "The 'hire_date' field is being mapped to 'startDate'. We need to ensure the target system accepts our output format.",
          priority: "medium"
        },
        {
          category: "edge_cases",
          question: "What values does 'is_active' currently contain?",
          context: "We are casting a string to a boolean. We need to know if it uses 'yes/no', '1/0', or 'true/false'.",
          priority: "high"
        }
      ]
    }), 1000));
  }

  const prompt = `You are a data migration consultant preparing for a migration planning meeting. Generate insightful clarification questions.

SOURCE SCHEMA: ${JSON.stringify(sourceSchema, null, 2)}
TARGET SCHEMA: ${JSON.stringify(targetSchema, null, 2)}
PROPOSED MAPPINGS: ${JSON.stringify(mappings, null, 2)}

Generate questions covering: business logic, data quality, edge cases, missing mappings, and recovery.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "questions": [
    {
      "category": "business_logic",
      "question": "The question text",
      "context": "Why this question matters",
      "priority": "high"
    }
  ]
}`;

  return generateJSON(prompt, 'clarification questions');
}

module.exports = { initializeAI, isInitialized, analyzeSchemas, assessRisks, generateQuestions };
