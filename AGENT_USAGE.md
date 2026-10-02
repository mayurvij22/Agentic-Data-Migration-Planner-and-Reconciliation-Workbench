# AGENT_USAGE.md — AI Agent & Tool Usage Documentation

## Overview

This document describes how AI tools were used during the development and within the application itself.

---

## 1. Development Tools Used

### Antigravity IDE (AI Coding Assistant)
- **Model:** Claude (Anthropic)
- **Usage:** Full application scaffolding, code generation, architecture design, debugging, and testing
- **Scope:** Generated all backend engines, API routes, React components, CSS design system, tests, and deployment config

### Google Gemini 1.5 Flash (In-App AI Agent)
- **SDK:** `@google/generative-ai` npm package
- **Usage:** Runtime AI features within the application
- **Functions:**
  - Schema analysis and field mapping proposals
  - Risk assessment for proposed mappings
  - Clarification question generation

---

## 2. Representative Prompts

### Schema Analysis Prompt (sent to Gemini)

```
You are an expert data migration consultant. Analyze the following 
source and target schemas and propose field mappings.

SOURCE SCHEMA (name: "employees"):
[{ name: "emp_id", type: "integer", required: true }, ...]

TARGET SCHEMA (name: "staff_members"):
[{ name: "id", type: "integer", required: true }, ...]

SUPPORTED TRANSFORMATION TYPES:
- rename: Rename a field
- typecast: Convert data types
- concat: Merge multiple source fields
[... all 11 types listed]

Respond ONLY with valid JSON containing:
- mappings (with sourceField, targetField, transformation, confidence, risk, reasoning)
- unmappedSourceFields
- unmappedTargetFields
- risks
- questions
- summary
```

### Risk Assessment Prompt

```
You are a data migration risk analyst. Assess the risks of the 
following field mappings:

MAPPINGS: [proposed mappings JSON]
SOURCE SCHEMA: [source fields]
TARGET SCHEMA: [target fields]

Analyze: data loss, type conversion issues, constraint violations, 
semantic mismatches.
```

### Clarification Questions Prompt

```
You are a data migration consultant preparing for a planning meeting.
Generate insightful clarification questions covering:
1. Business logic ambiguities
2. Data quality concerns
3. Edge cases
4. Missing mappings
5. Recovery scenarios
```

---

## 3. Work Delegated to AI

### In Development (Antigravity/Claude)

| Task | Delegated? | Verified How? |
|---|---|---|
| Architecture design | Yes | Manually reviewed plan, approved before execution |
| Backend engine code | Yes | Verified with 36 automated tests |
| API route design | Yes | Tested each endpoint via frontend integration |
| React component code | Yes | Visual verification in browser |
| CSS design system | Yes | Visual verification in browser |
| Test suite | Yes | All 36 tests pass, edge cases covered |
| Vercel config | Yes | Reviewed deployment configuration |

### In Application (Gemini 1.5 Flash)

| AI Action | Human Approval Required? | How Verified? |
|---|---|---|
| Schema analysis | No (read-only) | User reviews proposals in UI |
| Field mapping proposals | **Yes** — user must review and can edit | Mappings shown in table, editable |
| Risk assessment | No (advisory) | Displayed as risk badges with explanations |
| Clarification questions | No (advisory) | Shown as question cards |
| Create migration plan | **Yes** — user clicks "Create Plan" | Plan created in draft status |
| Approve plan | **Yes** — explicit approval button | Required before execution |
| Execute migration | **Yes** — user clicks "Execute" | Only available after approval |

---

## 4. Important Agent Mistakes & Rejected Suggestions

### During Development

1. **PowerShell command syntax:** The agent initially tried `cd client && npm run dev` which fails in PowerShell (needs `;` not `&&`). Fixed by running commands with explicit working directories.

2. **No significant rejected suggestions:** The architecture plan was reviewed and approved before code generation began. The agent followed the approved plan faithfully.

### In Application (Gemini AI)

The Gemini AI occasionally returns:
- **Overly confident mappings** for fields with only partial name matches (mitigated by showing confidence scores)
- **JSON parsing issues** when the model includes markdown formatting (handled by regex extraction)
- **Missing transformation configs** where the AI suggests a transformation type but doesn't include all required config parameters (handled gracefully by the transformation engine)

---

## 5. Output Verification

### Automated Tests (36 total)

```bash
node server/tests/engine.test.js
```

| Category | Tests | What's Verified |
|---|---|---|
| Transformations | 16 | All 11 types + error handling |
| Validation | 7 | Type checking, constraints, edge cases |
| Migration Engine | 4 | Dry run isolation, approval gate, dedup |
| Plan Versioning | 2 | Auto-increment, status management |
| Rollback | 3 | Record cleanup, status, guard rails |
| Reconciliation | 1 | Balanced count verification |
| Audit Log | 2 | Event recording |

### Manual Verification

1. **Full workflow test:** Setup → AI Analysis → Plan → Dry Run → Approve → Execute → Reconcile → Rollback
2. **Edge cases in sample data:**
   - Record 5: Invalid email (`invalid-email`), invalid date (`not-a-date`), invalid boolean (`yes`)
   - Record 6: Negative salary (`-5000`) — fails `min: 0` constraint
   - Record 8: Empty required field (`first_name: ""`)
   - Record 4: Null phone field
3. **Duplicate prevention:** Running execute twice skips already-inserted records
4. **Rollback verification:** Target records are removed, execution marked as rolled_back
5. **Reconciliation:** Source = Target + Quarantined + Duplicates

### UI State Verification

- **Loading states:** Spinner animations during API calls
- **Empty states:** Helpful messages when no data is loaded
- **Success states:** Green indicators, success toasts
- **Error states:** Red indicators, error toasts with server messages
- **Validation states:** Form inputs validated before submission

---

## 6. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check + store summary |
| `POST` | `/api/reset` | Reset all in-memory data |
| `POST` | `/api/schema/source` | Set source schema |
| `POST` | `/api/schema/target` | Set target schema |
| `GET` | `/api/schema` | Get both schemas |
| `POST` | `/api/schema/source/records` | Upload source records |
| `GET` | `/api/schema/source/records` | Get records (paginated) |
| `POST` | `/api/agent/init` | Initialize AI with API key |
| `GET` | `/api/agent/status` | Check AI initialization |
| `POST` | `/api/agent/analyze` | AI schema analysis |
| `POST` | `/api/agent/risks` | AI risk assessment |
| `POST` | `/api/agent/questions` | AI clarification questions |
| `GET` | `/api/migration/transformations` | List supported transformations |
| `POST` | `/api/migration/plan` | Create/update plan |
| `GET` | `/api/migration/plans` | List all plans |
| `GET` | `/api/migration/plan/:id` | Get plan details |
| `PUT` | `/api/migration/plan/:id/approve` | Approve plan |
| `POST` | `/api/migration/plan/:id/dry-run` | Deterministic dry run |
| `POST` | `/api/migration/plan/:id/execute` | Execute migration |
| `GET` | `/api/migration/executions` | List executions |
| `GET` | `/api/migration/execution/:id` | Get execution details |
| `POST` | `/api/migration/execution/:id/rollback` | Rollback execution |
| `GET` | `/api/reconciliation/:execId` | Reconciliation report |
| `GET` | `/api/reconciliation/:execId/compare` | Side-by-side comparison |
| `GET` | `/api/history` | Full audit log |
| `GET` | `/api/quarantine` | All quarantined records |
